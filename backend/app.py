import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "data" / "gifts.db"))
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", BASE_DIR / "uploads"))
ALLOWED_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
MAX_FILE_SIZE = 8 * 1024 * 1024
MAX_MUSIC_SIZE = 12 * 1024 * 1024
MAX_PHOTOS = 5
MAX_MESSAGE_LENGTH = 1000
DEFAULT_GIFT_PRICE_PAISE = 19900
GIFT_TYPES = {"birthday", "apology", "romantic", "friendship"}
GIFT_FEELINGS = {"love", "longing", "joy", "gratitude", "gentle"}
THEMES = {
    "petal": {"name": "Petal picnic", "type": "all"},
    "starlight": {"name": "Cloud nine", "type": "all"},
    "sunshine": {"name": "Berry sweet", "type": "all"},
    "peach": {"name": "Peachy keen", "type": "all"},
    "mint": {"name": "Mint to be", "type": "all"},
}
IMAGE_SIGNATURES = {
    "jpg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "webp": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
}
MUSIC_SIGNATURES = {
    "mp3": lambda data: data.startswith(b"ID3")
    or (len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0),
    "wav": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE",
    "ogg": lambda data: data.startswith(b"OggS"),
}


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=MAX_FILE_SIZE * MAX_PHOTOS + MAX_MUSIC_SIZE + 1024 * 1024,
        RAZORPAY_KEY_ID=os.environ.get("RAZORPAY_KEY_ID", ""),
        RAZORPAY_KEY_SECRET=os.environ.get("RAZORPAY_KEY_SECRET", ""),
        RAZORPAY_WEBHOOK_SECRET=os.environ.get("RAZORPAY_WEBHOOK_SECRET", ""),
        GIFT_PRICE_PAISE=int(os.environ.get("GIFT_PRICE_PAISE", str(DEFAULT_GIFT_PRICE_PAISE))),
        GIFT_CURRENCY=os.environ.get("GIFT_CURRENCY", "INR"),
    )
    if test_config:
        app.config.update(test_config)
    price_paise = app.config["GIFT_PRICE_PAISE"]
    if not isinstance(price_paise, int) or not 100 <= price_paise <= 100_000_000:
        raise ValueError("GIFT_PRICE_PAISE must be from 100 to 100000000 paise.")
    if not isinstance(app.config["GIFT_CURRENCY"], str) or not re.fullmatch(
        r"[A-Z]{3}", app.config["GIFT_CURRENCY"]
    ):
        raise ValueError("GIFT_CURRENCY must be a three-letter uppercase ISO currency code.")

    def database_path():
        return Path(app.config.get("DATABASE_PATH", DATABASE_PATH))

    def upload_dir():
        return Path(app.config.get("UPLOAD_DIR", UPLOAD_DIR))

    def valid_occasion_date(value):
        if value is None:
            return True
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return False
        try:
            date.fromisoformat(value)
        except ValueError:
            return False
        return True

    def experience_options_error(data):
        feeling = data.get("feeling")
        if feeling is not None and (not isinstance(feeling, str) or feeling not in GIFT_FEELINGS):
            return "Choose one of the available feelings."
        notes = data.get("secret_notes", [])
        if (
            not isinstance(notes, list)
            or len(notes) > 3
            or any(not isinstance(note, str) or len(note) > 160 for note in notes)
        ):
            return "Add up to three little notes, with 160 characters or fewer each."
        soundtrack = data.get("soundtrack", "silent")
        if not isinstance(soundtrack, str) or soundtrack not in {"music-box", "silent"}:
            return "Choose the original music box or no background tune."
        return None

    @contextmanager
    def connect():
        path = database_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize_database():
        with connect() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS gifts (
                    id TEXT PRIMARY KEY,
                    slug TEXT UNIQUE,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )"""
            )
            connection.execute(
                """CREATE TABLE IF NOT EXISTS payment_orders (
                    order_id TEXT PRIMARY KEY,
                    gift_id TEXT NOT NULL REFERENCES gifts(id),
                    amount INTEGER NOT NULL,
                    currency TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('created', 'paid')),
                    payment_id TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )"""
            )

    initialize_database()

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin == ALLOWED_ORIGIN or app.config.get("TESTING"):
            response.headers["Access-Control-Allow-Origin"] = origin or ALLOWED_ORIGIN
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify(error="Upload too large. Photos are limited to 8 MB each and music to 12 MB."), 413

    def payments_enabled():
        return bool(app.config["RAZORPAY_KEY_ID"] or app.config["RAZORPAY_KEY_SECRET"])

    def payment_credentials_ready():
        return bool(app.config["RAZORPAY_KEY_ID"] and app.config["RAZORPAY_KEY_SECRET"])

    def razorpay_request(path, method="GET", payload=None):
        credentials = f"{app.config['RAZORPAY_KEY_ID']}:{app.config['RAZORPAY_KEY_SECRET']}"
        authorization = base64.b64encode(credentials.encode("utf-8")).decode("ascii")
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Authorization": f"Basic {authorization}"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        provider_request = Request(
            f"https://api.razorpay.com/v1/{path}",
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(provider_request, timeout=10) as response:
                return json.loads(response.read())
        except HTTPError:
            app.logger.exception("Razorpay rejected a payment request")
            raise
        except URLError:
            app.logger.exception("Could not reach Razorpay")
            raise

    @app.get("/api/themes")
    def list_themes():
        return jsonify(themes=[{"id": key, **value} for key, value in THEMES.items()])

    @app.get("/api/config")
    def public_config():
        enabled = payments_enabled()
        return jsonify(
            payments_enabled=enabled,
            payments_configured=payment_credentials_ready(),
            razorpay_key_id=app.config["RAZORPAY_KEY_ID"] if payment_credentials_ready() else None,
            price_paise=app.config["GIFT_PRICE_PAISE"],
            currency=app.config["GIFT_CURRENCY"],
        )

    @app.post("/api/gifts")
    def create_gift():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Send gift details as JSON."), 400

        gift_type = data.get("type")
        theme = data.get("theme")
        recipient = data.get("recipient_name")
        sender = data.get("sender_name")
        message = data.get("message")
        occasion_date = data.get("occasion_date")
        photo_captions = data.get("photo_captions", [])
        if not isinstance(gift_type, str) or gift_type not in GIFT_TYPES:
            return jsonify(error="Choose a supported occasion."), 400
        if not isinstance(theme, str) or theme not in THEMES:
            return jsonify(error="Choose one of the available themes."), 400
        if not all(isinstance(value, str) and value.strip() for value in (recipient, sender, message)):
            return jsonify(error="Recipient name, sender name, and message are required."), 400
        if len(recipient.strip()) > 60 or len(sender.strip()) > 60:
            return jsonify(error="Names must be 60 characters or fewer."), 400
        if len(message.strip()) > MAX_MESSAGE_LENGTH:
            return jsonify(error=f"Messages must be {MAX_MESSAGE_LENGTH} characters or fewer."), 400
        if not valid_occasion_date(occasion_date):
            return jsonify(error="Choose a valid occasion date."), 400
        if (
            not isinstance(photo_captions, list)
            or len(photo_captions) > MAX_PHOTOS
            or any(not isinstance(caption, str) or len(caption) > 100 for caption in photo_captions)
        ):
            return jsonify(error="Photo captions must be 100 characters or fewer."), 400
        options_error = experience_options_error(data)
        if options_error:
            return jsonify(error=options_error), 400

        gift_id = secrets.token_urlsafe(24)
        payload = {
            "type": gift_type,
            "theme": theme,
            "recipient_name": recipient.strip(),
            "sender_name": sender.strip(),
            "message": message.strip(),
            "media": [],
            "photo_captions": photo_captions,
            "music_url": None,
            "occasion_date": occasion_date,
            "feeling": data.get("feeling"),
            "secret_notes": [note.strip() for note in data.get("secret_notes", []) if note.strip()],
            "soundtrack": data.get("soundtrack", "silent"),
        }
        with connect() as connection:
            connection.execute(
                "INSERT INTO gifts (id, payload, status) VALUES (?, ?, 'draft')",
                (gift_id, json.dumps(payload, ensure_ascii=False)),
            )
        return jsonify(id=gift_id, status="draft"), 201

    @app.patch("/api/gifts/<gift_id>")
    def update_draft(gift_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Send gift updates as JSON."), 400
        with connect() as connection:
            row = connection.execute(
                "SELECT payload, status FROM gifts WHERE id = ?", (gift_id,)
            ).fetchone()
            if row is None or row["status"] != "draft":
                return jsonify(error="This draft is unavailable or already published."), 404
            payload = json.loads(row["payload"])
            for key in (
                "recipient_name", "sender_name", "message", "theme", "type",
                "occasion_date", "photo_captions", "feeling", "secret_notes", "soundtrack",
            ):
                if key in data:
                    payload[key] = data[key]
            if (
                not isinstance(payload.get("type"), str)
                or payload["type"] not in GIFT_TYPES
                or not isinstance(payload.get("theme"), str)
                or payload["theme"] not in THEMES
            ):
                return jsonify(error="Choose a supported occasion and theme."), 400
            if not all(
                isinstance(payload.get(key), str) and payload[key].strip()
                for key in ("recipient_name", "sender_name", "message")
            ):
                return jsonify(error="Recipient name, sender name, and message are required."), 400
            if len(payload["recipient_name"]) > 60 or len(payload["sender_name"]) > 60:
                return jsonify(error="Names must be 60 characters or fewer."), 400
            if len(payload["message"]) > MAX_MESSAGE_LENGTH:
                return jsonify(error=f"Messages must be {MAX_MESSAGE_LENGTH} characters or fewer."), 400
            occasion_date = payload.get("occasion_date")
            if not valid_occasion_date(occasion_date):
                return jsonify(error="Choose a valid occasion date."), 400
            captions = payload.get("photo_captions", [])
            if (
                not isinstance(captions, list)
                or len(captions) > MAX_PHOTOS
                or any(not isinstance(caption, str) or len(caption) > 100 for caption in captions)
            ):
                return jsonify(error="Photo captions must be 100 characters or fewer."), 400
            options_error = experience_options_error(payload)
            if options_error:
                return jsonify(error=options_error), 400
            payload["secret_notes"] = [
                note.strip() for note in payload.get("secret_notes", []) if note.strip()
            ]
            connection.execute(
                "UPDATE gifts SET payload = ? WHERE id = ?",
                (json.dumps(payload, ensure_ascii=False), gift_id),
            )
        return jsonify(status="draft")

    @app.post("/api/gifts/<gift_id>/media")
    def upload_media(gift_id):
        with connect() as connection:
            row = connection.execute(
                "SELECT payload, status FROM gifts WHERE id = ?", (gift_id,)
            ).fetchone()
            if row is None or row["status"] != "draft":
                return jsonify(error="This draft is unavailable or already published."), 404
            files = request.files.getlist("files")
            if not files:
                return jsonify(error="Choose at least one image to upload."), 400
            payload = json.loads(row["payload"])
            current_media = payload.get("media", [])
            if len(current_media) + len(files) > MAX_PHOTOS:
                return jsonify(error=f"A gift can include up to {MAX_PHOTOS} photos."), 400

            saved_paths = []
            media_urls = []
            try:
                upload_dir().mkdir(parents=True, exist_ok=True)
                for file in files:
                    if not file.filename:
                        raise ValueError("Choose a photo with a file name.")
                    extension = Path(file.filename).suffix.lower().lstrip(".")
                    if extension not in IMAGE_SIGNATURES:
                        raise ValueError("Photos must be JPG, PNG, or WebP images.")
                    content = file.stream.read(MAX_FILE_SIZE + 1)
                    if not content:
                        raise ValueError("An uploaded photo was empty.")
                    if len(content) > MAX_FILE_SIZE:
                        raise ValueError("Each photo must be 8 MB or smaller.")
                    if not IMAGE_SIGNATURES[extension](content):
                        raise ValueError("A photo's file contents did not match its image type.")
                    filename = f"{secrets.token_urlsafe(18)}.{extension}"
                    destination = upload_dir() / filename
                    destination.write_bytes(content)
                    saved_paths.append(destination)
                    media_urls.append(f"/api/media/{filename}")
            except ValueError as error:
                for path in saved_paths:
                    path.unlink(missing_ok=True)
                return jsonify(error=str(error)), 400
            except OSError:
                for path in saved_paths:
                    path.unlink(missing_ok=True)
                app.logger.exception("Could not store gift media")
                return jsonify(error="We couldn't save your photos. Please try again."), 500

            payload["media"] = current_media + media_urls
            payload["photo_captions"] = payload.get("photo_captions", [])[:MAX_PHOTOS]
            connection.execute(
                "UPDATE gifts SET payload = ? WHERE id = ?",
                (json.dumps(payload, ensure_ascii=False), gift_id),
            )
        return jsonify(media=media_urls), 201

    @app.delete("/api/gifts/<gift_id>/media/<int:media_index>")
    def delete_media(gift_id, media_index):
        with connect() as connection:
            row = connection.execute(
                "SELECT payload, status FROM gifts WHERE id = ?", (gift_id,)
            ).fetchone()
            if row is None or row["status"] != "draft":
                return jsonify(error="This draft is unavailable or already published."), 404
            payload = json.loads(row["payload"])
            media = payload.get("media", [])
            if media_index < 0 or media_index >= len(media):
                return jsonify(error="That photo is no longer in this draft."), 404

            filename = Path(media[media_index]).name
            if not re.fullmatch(r"[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)", filename):
                return jsonify(error="That photo couldn't be found in this draft."), 404
            destination = (upload_dir() / filename).resolve()
            if destination.parent != upload_dir().resolve():
                return jsonify(error="That photo couldn't be found in this draft."), 404
            try:
                destination.unlink(missing_ok=True)
            except OSError:
                app.logger.exception("Could not remove gift photo")
                return jsonify(error="We couldn't remove that photo. Please try again."), 500

            del media[media_index]
            payload["media"] = media
            captions = payload.get("photo_captions", [])
            if isinstance(captions, list) and media_index < len(captions):
                del captions[media_index]
                payload["photo_captions"] = captions
            connection.execute(
                "UPDATE gifts SET payload = ? WHERE id = ?",
                (json.dumps(payload, ensure_ascii=False), gift_id),
            )
        return jsonify(media=payload["media"], photo_captions=payload.get("photo_captions", []))

    @app.post("/api/gifts/<gift_id>/music")
    def upload_music(gift_id):
        with connect() as connection:
            row = connection.execute(
                "SELECT payload, status FROM gifts WHERE id = ?", (gift_id,)
            ).fetchone()
            if row is None or row["status"] != "draft":
                return jsonify(error="This draft is unavailable or already published."), 404
            file = request.files.get("file")
            if file is None or not file.filename:
                return jsonify(error="Choose an MP3, WAV, or OGG track."), 400
            extension = Path(file.filename).suffix.lower().lstrip(".")
            if extension not in MUSIC_SIGNATURES:
                return jsonify(error="Music must be an MP3, WAV, or OGG file."), 400
            content = file.stream.read(MAX_MUSIC_SIZE + 1)
            if not content:
                return jsonify(error="The selected music file is empty."), 400
            if len(content) > MAX_MUSIC_SIZE:
                return jsonify(error="Music files must be 12 MB or smaller."), 400
            if not MUSIC_SIGNATURES[extension](content):
                return jsonify(error="The file contents did not match the selected music format."), 400

            destination = upload_dir() / f"{secrets.token_urlsafe(18)}.{extension}"
            try:
                upload_dir().mkdir(parents=True, exist_ok=True)
                destination.write_bytes(content)
            except OSError:
                destination.unlink(missing_ok=True)
                app.logger.exception("Could not store gift music")
                return jsonify(error="We couldn't save your music. Please try again."), 500

            payload = json.loads(row["payload"])
            previous_url = payload.get("music_url")
            payload["music_url"] = f"/api/media/{destination.name}"
            connection.execute(
                "UPDATE gifts SET payload = ? WHERE id = ?",
                (json.dumps(payload, ensure_ascii=False), gift_id),
            )
        if previous_url:
            previous_name = previous_url.rsplit("/", 1)[-1]
            if re.fullmatch(r"[A-Za-z0-9_-]+\.(mp3|wav|ogg)", previous_name):
                (upload_dir() / previous_name).unlink(missing_ok=True)
        return jsonify(music_url=payload["music_url"]), 201

    @app.get("/api/media/<path:filename>")
    def get_media(filename):
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|mp3|wav|ogg)", filename):
            return jsonify(error="Media not found."), 404
        return send_from_directory(upload_dir(), filename, max_age=3600)

    @app.post("/api/payments/order")
    def create_payment_order():
        if not payment_credentials_ready():
            return jsonify(error="Razorpay credentials are incomplete. Configure both keys before checkout."), 503
        data = request.get_json(silent=True)
        gift_id = data.get("gift_id") if isinstance(data, dict) else None
        if not isinstance(gift_id, str) or not gift_id:
            return jsonify(error="A gift draft is required to start checkout."), 400
        with connect() as connection:
            gift = connection.execute(
                "SELECT status FROM gifts WHERE id = ?", (gift_id,)
            ).fetchone()
        if gift is None or gift["status"] != "draft":
            return jsonify(error="This draft is unavailable for checkout."), 404
        amount = app.config["GIFT_PRICE_PAISE"]
        currency = app.config["GIFT_CURRENCY"]
        try:
            provider_order = razorpay_request(
                "orders",
                method="POST",
                payload={
                    "amount": amount,
                    "currency": currency,
                    "receipt": f"gift-{secrets.token_hex(12)}",
                    "notes": {"gift_id": gift_id},
                },
            )
        except (HTTPError, URLError):
            return jsonify(error="Razorpay could not create the payment order. Please try again."), 502
        order_id = provider_order.get("id")
        if not isinstance(order_id, str) or not order_id.startswith("order_"):
            app.logger.error("Razorpay returned an invalid payment order")
            return jsonify(error="Razorpay returned an invalid payment order."), 502
        with connect() as connection:
            connection.execute(
                """INSERT INTO payment_orders (order_id, gift_id, amount, currency, status)
                   VALUES (?, ?, ?, ?, 'created')""",
                (order_id, gift_id, amount, currency),
            )
        return jsonify(
            order_id=order_id,
            amount=amount,
            currency=currency,
            key_id=app.config["RAZORPAY_KEY_ID"],
        ), 201

    @app.post("/api/payments/verify")
    def verify_payment():
        if not payment_credentials_ready():
            return jsonify(error="Razorpay credentials are incomplete. Configure both keys before verifying payment."), 503
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Send the payment confirmation as JSON."), 400
        order_id = data.get("razorpay_order_id")
        payment_id = data.get("razorpay_payment_id")
        signature = data.get("razorpay_signature")
        if (
            not all(isinstance(value, str) and value for value in (order_id, payment_id, signature))
            or not re.fullmatch(r"order_[A-Za-z0-9]+", order_id)
            or not re.fullmatch(r"pay_[A-Za-z0-9]+", payment_id)
            or not re.fullmatch(r"[A-Fa-f0-9]{64}", signature)
        ):
            return jsonify(error="Razorpay did not return a complete payment confirmation."), 400
        signed_data = f"{order_id}|{payment_id}".encode("utf-8")
        expected_signature = hmac.new(
            app.config["RAZORPAY_KEY_SECRET"].encode("utf-8"),
            signed_data,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_signature, signature):
            return jsonify(error="The payment signature could not be verified."), 400
        with connect() as connection:
            order = connection.execute(
                "SELECT * FROM payment_orders WHERE order_id = ?", (order_id,)
            ).fetchone()
            if order is None:
                return jsonify(error="This payment order is not associated with a gift."), 404
            if order["status"] == "paid" and order["payment_id"] == payment_id:
                return jsonify(status="paid")
        try:
            provider_payment = razorpay_request(f"payments/{payment_id}")
        except (HTTPError, URLError):
            return jsonify(error="Razorpay could not verify the payment yet. Please retry."), 502
        if (
            provider_payment.get("order_id") != order_id
            or provider_payment.get("amount") != order["amount"]
            or provider_payment.get("currency") != order["currency"]
            or provider_payment.get("status") != "captured"
        ):
            return jsonify(error="The payment is not captured for this gift order yet."), 400
        with connect() as connection:
            connection.execute(
                "UPDATE payment_orders SET status = 'paid', payment_id = ? WHERE order_id = ?",
                (payment_id, order_id),
            )
        return jsonify(status="paid")

    @app.post("/api/payments/webhook")
    def payment_webhook():
        secret = app.config["RAZORPAY_WEBHOOK_SECRET"]
        signature = request.headers.get("X-Razorpay-Signature", "")
        if not secret or not signature:
            return jsonify(error="Webhook verification is not configured."), 503
        expected_signature = hmac.new(
            secret.encode("utf-8"), request.get_data(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_signature, signature):
            return jsonify(error="Invalid webhook signature."), 400
        event = request.get_json(silent=True)
        if not isinstance(event, dict):
            return jsonify(error="Invalid webhook event."), 400
        if event.get("event") not in {"payment.captured", "order.paid"}:
            return jsonify(status="ignored")
        payload = event.get("payload", {})
        payment_entity = payload.get("payment", {}).get("entity", {})
        order_entity = payload.get("order", {}).get("entity", {})
        order_id = payment_entity.get("order_id") or order_entity.get("id")
        payment_id = payment_entity.get("id")
        if (
            not isinstance(order_id, str)
            or not isinstance(payment_id, str)
            or payment_entity.get("status") != "captured"
        ):
            return jsonify(status="ignored")
        with connect() as connection:
            order = connection.execute(
                "SELECT amount, currency FROM payment_orders WHERE order_id = ?",
                (order_id,),
            ).fetchone()
            if (
                order is None
                or payment_entity.get("amount") != order["amount"]
                or payment_entity.get("currency") != order["currency"]
            ):
                return jsonify(error="Webhook payment does not match the gift order."), 400
            connection.execute(
                "UPDATE payment_orders SET status = 'paid', payment_id = ? WHERE order_id = ?",
                (payment_id, order_id),
            )
        return jsonify(status="paid")

    @app.post("/api/gifts/<gift_id>/publish")
    def publish_gift(gift_id):
        with connect() as connection:
            row = connection.execute(
                "SELECT payload, status, slug FROM gifts WHERE id = ?", (gift_id,)
            ).fetchone()
            if row is None:
                return jsonify(error="This draft could not be found."), 404
            if row["status"] == "published":
                return jsonify(slug=row["slug"], status="published")
            payload = json.loads(row["payload"])
            if not all(payload.get(key) for key in ("recipient_name", "sender_name", "message")):
                return jsonify(error="Add the names and message before publishing."), 400
            if payments_enabled():
                paid_order = connection.execute(
                    "SELECT 1 FROM payment_orders WHERE gift_id = ? AND status = 'paid'",
                    (gift_id,),
                ).fetchone()
                if paid_order is None:
                    return jsonify(error="Complete payment before publishing this gift."), 402
            slug = secrets.token_urlsafe(18)
            connection.execute(
                "UPDATE gifts SET slug = ?, status = 'published' WHERE id = ?",
                (slug, gift_id),
            )
        return jsonify(slug=slug, status="published"), 201

    @app.get("/api/gifts/<slug>")
    def get_gift(slug):
        with connect() as connection:
            row = connection.execute(
                "SELECT payload FROM gifts WHERE slug = ? AND status = 'published'",
                (slug,),
            ).fetchone()
        if row is None:
            return jsonify(error="This little moment couldn't be found."), 404
        return jsonify(json.loads(row["payload"]))

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)

import hashlib
import hmac
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import create_app


class GiftApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.app = create_app({
            "TESTING": True,
            "DATABASE_PATH": root / "gifts.db",
            "UPLOAD_DIR": root / "uploads",
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def create_draft(self, **overrides):
        gift = {
            "type": "birthday",
            "theme": "petal",
            "recipient_name": "Taylor",
            "sender_name": "Jamie",
            "message": "You make every day brighter.",
        }
        gift.update(overrides)
        return self.client.post("/api/gifts", json=gift)

    def test_themes_and_draft_validation(self):
        themes = self.client.get("/api/themes")
        self.assertEqual(themes.status_code, 200)
        self.assertEqual(len(themes.json["themes"]), 5)
        config = self.client.get("/api/config")
        self.assertFalse(config.json["payments_enabled"])
        self.assertFalse(config.json["payments_configured"])
        self.assertEqual(config.json["price_paise"], 19900)
        self.assertEqual(self.create_draft(type="unknown").status_code, 400)
        self.assertEqual(self.create_draft(type=[]).status_code, 400)
        self.assertEqual(self.create_draft(message=" ").status_code, 400)
        self.assertEqual(self.create_draft(photo_captions="not a list").status_code, 400)
        self.assertEqual(self.create_draft(type="friendship").status_code, 201)
        self.assertEqual(self.create_draft().status_code, 201)

    def test_published_gift_is_retrievable_only_by_its_random_slug(self):
        draft = self.create_draft()
        draft_id = draft.json["id"]
        self.assertNotEqual(self.client.get(f"/api/gifts/{draft_id}").status_code, 200)
        published = self.client.post(f"/api/gifts/{draft_id}/publish")
        self.assertEqual(published.status_code, 201)
        self.assertNotEqual(published.json["slug"], draft_id)
        result = self.client.get(f"/api/gifts/{published.json['slug']}")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["recipient_name"], "Taylor")
        self.assertEqual(self.client.post(f"/api/gifts/{draft_id}/publish").json["slug"], published.json["slug"])

    def test_feeling_notes_and_soundtrack_survive_editing_and_publishing(self):
        draft = self.create_draft(
            type="romantic", feeling="longing", theme="starlight",
            secret_notes=[" Your terrible jokes. ", "", "The way you listen."],
            soundtrack="music-box",
        )
        self.assertEqual(draft.status_code, 201)
        draft_id = draft.json["id"]
        updated = self.client.patch(
            f"/api/gifts/{draft_id}",
            json={"feeling": "gratitude", "theme": "peach", "message": "Thank you for being you."},
        )
        self.assertEqual(updated.status_code, 200)
        slug = self.client.post(f"/api/gifts/{draft_id}/publish").json["slug"]
        gift = self.client.get(f"/api/gifts/{slug}").json
        self.assertEqual(gift["feeling"], "gratitude")
        self.assertEqual(gift["theme"], "peach")
        self.assertEqual(gift["secret_notes"], ["Your terrible jokes.", "The way you listen."])
        self.assertEqual(gift["soundtrack"], "music-box")
        self.assertEqual(gift["message"], "Thank you for being you.")

    def test_new_experience_fields_validate_create_and_patch_without_mutating_drafts(self):
        draft_id = self.create_draft(feeling="love", secret_notes=["Keep this note."]).json["id"]
        invalid_options = [
            {"feeling": "unknown"}, {"feeling": []},
            {"secret_notes": "not a list"}, {"secret_notes": [None]},
            {"secret_notes": ["a"] * 4}, {"secret_notes": ["a" * 161]},
            {"soundtrack": None}, {"soundtrack": []}, {"soundtrack": "external"},
        ]
        for options in invalid_options:
            with self.subTest(options=options):
                created = self.create_draft(**options)
                updated = self.client.patch(f"/api/gifts/{draft_id}", json=options)
                self.assertEqual(created.status_code, 400)
                self.assertEqual(updated.status_code, 400)
                self.assertIn("error", updated.json)
        slug = self.client.post(f"/api/gifts/{draft_id}/publish").json["slug"]
        gift = self.client.get(f"/api/gifts/{slug}").json
        self.assertEqual(gift["feeling"], "love")
        self.assertEqual(gift["secret_notes"], ["Keep this note."])

    def test_optional_experience_fields_keep_legacy_clients_silent(self):
        draft_id = self.create_draft().json["id"]
        slug = self.client.post(f"/api/gifts/{draft_id}/publish").json["slug"]
        gift = self.client.get(f"/api/gifts/{slug}").json
        self.assertIsNone(gift["feeling"])
        self.assertEqual(gift["secret_notes"], [])
        self.assertEqual(gift["soundtrack"], "silent")
        boundary = self.create_draft(secret_notes=["a" * 160] * 3)
        self.assertEqual(boundary.status_code, 201)
        reset = self.client.patch(
            f"/api/gifts/{boundary.json['id']}",
            json={"secret_notes": [], "feeling": None, "soundtrack": "silent"},
        )
        self.assertEqual(reset.status_code, 200)
        preflight = self.client.options(
            f"/api/gifts/{boundary.json['id']}/media/0",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "DELETE"},
        )
        self.assertIn("DELETE", preflight.headers["Access-Control-Allow-Methods"])

    def test_upload_accepts_real_png_and_rejects_mismatched_or_oversized_files(self):
        draft_id = self.create_draft().json["id"]
        png = b"\x89PNG\r\n\x1a\n" + b"test image data"
        upload = self.client.post(
            f"/api/gifts/{draft_id}/media",
            data={"files": (io.BytesIO(png), "memory.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload.status_code, 201)
        self.assertEqual(len(upload.json["media"]), 1)
        served_photo = self.client.get(upload.json["media"][0])
        self.assertEqual(served_photo.status_code, 200)
        self.assertEqual(served_photo.mimetype, "image/png")
        served_photo.close()

        mismatch = self.client.post(
            f"/api/gifts/{draft_id}/media",
            data={"files": (io.BytesIO(b"not a png"), "bad.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(mismatch.status_code, 400)

        oversized = self.client.post(
            f"/api/gifts/{draft_id}/media",
            data={"files": (io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * (8 * 1024 * 1024)), "large.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(oversized.status_code, 400)

    def test_friendship_gift_keeps_captions_and_can_remove_an_uploaded_photo(self):
        draft_id = self.create_draft(
            type="friendship",
            photo_captions=["The day we got lost", "Our rainy-day picnic"],
        ).json["id"]
        upload = self.client.post(
            f"/api/gifts/{draft_id}/media",
            data={"files": [
                (io.BytesIO(b"\x89PNG\r\n\x1a\nphoto one"), "memory-one.png"),
                (io.BytesIO(b"\x89PNG\r\n\x1a\nphoto two"), "memory-two.png"),
            ]},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload.status_code, 201)

        removed = self.client.delete(f"/api/gifts/{draft_id}/media/0")
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(len(removed.json["media"]), 1)
        self.assertEqual(removed.json["photo_captions"], ["Our rainy-day picnic"])

        self.assertEqual(self.client.delete(f"/api/gifts/{draft_id}/media/1").status_code, 404)
        published = self.client.post(f"/api/gifts/{draft_id}/publish")
        gift = self.client.get(f"/api/gifts/{published.json['slug']}")
        self.assertEqual(gift.json["type"], "friendship")
        self.assertEqual(len(gift.json["media"]), 1)
        self.assertEqual(gift.json["photo_captions"], ["Our rainy-day picnic"])

    def test_public_route_does_not_expose_drafts_or_accept_invalid_slug_paths(self):
        self.assertEqual(self.client.get("/api/gifts/not-a-gift").status_code, 404)
        draft_id = self.create_draft().json["id"]
        self.assertEqual(self.client.patch(f"/api/gifts/{draft_id}", json={"message": "Updated"}).status_code, 200)
        self.assertEqual(self.client.get(f"/api/gifts/{draft_id}").status_code, 404)
        self.assertEqual(self.create_draft(occasion_date="2026-99-99").status_code, 400)

    def test_music_upload_checks_format_and_is_available_to_the_recipient(self):
        draft_id = self.create_draft().json["id"]
        audio = b"ID3" + b"\x04\x00\x00" + b"\x00" * 12
        upload = self.client.post(
            f"/api/gifts/{draft_id}/music",
            data={"file": (io.BytesIO(audio), "our-song.mp3")},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload.status_code, 201)
        served_music = self.client.get(upload.json["music_url"])
        self.assertEqual(served_music.status_code, 200)
        self.assertEqual(served_music.mimetype, "audio/mpeg")
        served_music.close()

        invalid = self.client.post(
            f"/api/gifts/{draft_id}/music",
            data={"file": (io.BytesIO(b"not audio"), "fake.mp3")},
            content_type="multipart/form-data",
        )
        self.assertEqual(invalid.status_code, 400)

        gift = self.client.patch(f"/api/gifts/{draft_id}", json={"occasion_date": "2026-10-31"})
        self.assertEqual(gift.status_code, 200)
        published = self.client.post(f"/api/gifts/{draft_id}/publish")
        self.assertEqual(published.status_code, 201)
        recipient = self.client.get(f"/api/gifts/{published.json['slug']}")
        self.assertEqual(recipient.json["occasion_date"], "2026-10-31")
        self.assertEqual(recipient.json["music_url"], upload.json["music_url"])

    def test_paid_gifts_require_razorpay_signature_and_captured_payment(self):
        secret = "payment-test-secret"
        self.app.config.update(
            RAZORPAY_KEY_ID="rzp_test_example",
            RAZORPAY_KEY_SECRET=secret,
            GIFT_PRICE_PAISE=2500,
            GIFT_CURRENCY="INR",
        )
        gift_id = self.create_draft().json["id"]
        self.assertEqual(self.client.post(f"/api/gifts/{gift_id}/publish").status_code, 402)

        class ProviderResponse:
            def __init__(self, payload):
                self.payload = json.dumps(payload).encode()

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self):
                return self.payload

        with patch(
            "app.urlopen",
            side_effect=[
                ProviderResponse({"id": "order_test123"}),
                ProviderResponse({
                    "id": "pay_test123",
                    "order_id": "order_test123",
                    "amount": 2500,
                    "currency": "INR",
                    "status": "captured",
                }),
            ],
        ) as provider:
            created_order = self.client.post("/api/payments/order", json={"gift_id": gift_id})
            self.assertEqual(created_order.status_code, 201)
            self.assertEqual(created_order.json["amount"], 2500)
            self.assertEqual(provider.call_count, 1)

            signature = hmac.new(
                secret.encode(),
                b"order_test123|pay_test123",
                hashlib.sha256,
            ).hexdigest()
            invalid = self.client.post("/api/payments/verify", json={
                "razorpay_order_id": "order_test123",
                "razorpay_payment_id": "pay_test123",
                "razorpay_signature": "0" * 64,
            })
            self.assertEqual(invalid.status_code, 400)
            self.assertEqual(provider.call_count, 1)

            verified = self.client.post("/api/payments/verify", json={
                "razorpay_order_id": "order_test123",
                "razorpay_payment_id": "pay_test123",
                "razorpay_signature": signature,
            })
            self.assertEqual(verified.status_code, 200)
            self.assertEqual(verified.json["status"], "paid")
            self.assertEqual(self.client.post(f"/api/gifts/{gift_id}/publish").status_code, 201)

    def test_partial_payment_setup_fails_closed_instead_of_publishing_for_free(self):
        self.app.config.update(RAZORPAY_KEY_ID="rzp_test_incomplete")
        gift_id = self.create_draft().json["id"]
        config = self.client.get("/api/config")
        self.assertTrue(config.json["payments_enabled"])
        self.assertFalse(config.json["payments_configured"])
        self.assertIsNone(config.json["razorpay_key_id"])
        self.assertEqual(self.client.post("/api/payments/order", json={"gift_id": gift_id}).status_code, 503)
        self.assertEqual(self.client.post(f"/api/gifts/{gift_id}/publish").status_code, 402)

    def test_razorpay_webhook_requires_a_valid_signature_and_matches_the_order(self):
        secret = "webhook-test-secret"
        self.app.config.update(
            RAZORPAY_KEY_ID="rzp_test_example",
            RAZORPAY_KEY_SECRET="payment-test-secret",
            RAZORPAY_WEBHOOK_SECRET=secret,
        )
        gift_id = self.create_draft().json["id"]

        class ProviderResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self):
                return json.dumps({"id": "order_webhook123"}).encode()

        with patch("app.urlopen", return_value=ProviderResponse()):
            order = self.client.post("/api/payments/order", json={"gift_id": gift_id})
        self.assertEqual(order.status_code, 201)

        event = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_webhook123",
                        "order_id": "order_webhook123",
                        "status": "captured",
                        "amount": 19900,
                        "currency": "INR",
                    }
                }
            },
        }
        body = json.dumps(event).encode()
        signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        rejected = self.client.post(
            "/api/payments/webhook",
            data=body,
            headers={"X-Razorpay-Signature": "0" * 64, "Content-Type": "application/json"},
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(self.client.post(f"/api/gifts/{gift_id}/publish").status_code, 402)

        accepted = self.client.post(
            "/api/payments/webhook",
            data=body,
            headers={"X-Razorpay-Signature": signature, "Content-Type": "application/json"},
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(self.client.post(f"/api/gifts/{gift_id}/publish").status_code, 201)


if __name__ == "__main__":
    unittest.main()

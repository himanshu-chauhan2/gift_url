# Little Moments

Little Moments turns a personal note and a few photos into a shareable digital
gift. The MVP includes a responsive landing page, a three-step gift creator,
private random gift links, and recipient experiences for birthday, apology,
romantic, and friendship gifts.

## Run locally on Windows

Use two terminals.

### Flask API

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The API runs at `http://localhost:5000`. Gift records are stored in
`backend\data\gifts.db`; uploaded photos go in `backend\uploads`. Both are
created automatically and excluded from version control.

### Next.js website

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. By default, browser API and media requests use
the website's own origin. Next.js proxies `/api/*` to `http://127.0.0.1:5000`,
so a phone opening your computer's LAN address does not try to contact
`localhost` on the phone. The phone must be on the same network, and Windows
Firewall must allow the frontend port. Local links are not public internet links.

Set server-only `API_PROXY_TARGET` before starting or building the frontend to
change the proxy destination. Alternatively, `NEXT_PUBLIC_API_URL` can explicitly
point browsers at a separately hosted API; that API must be reachable from
recipients' devices. Set `FRONTEND_ORIGIN` on the API to the website's exact
origin when using a separate API origin.

## Included experiences

- Illustrated first screen: expressive bear-and-bunny characters, floating
  keepsakes, blinking eyes, a pulsing heart, and a tap-to-reveal sample note.
  Love, missing-you, and birthday demos change the scene, colours and headline;
  missing-you gifts have a moonlit sky, while gentle gifts keep a calm flower.
- Shared gift artwork: the creator's colour preview and recipient's animated
  envelope use the same original illustrated scenes. Richer colours, dimensional
  paper cards, photo entrances, and unfolding notes carry through the journey.
  Home and recipient motion controls also respect reduced-motion device settings.
- Recipient story: chapter progress, a persistent thumb-friendly next-step dock,
  and a direct route to the letter keep the journey easy to follow. Games, notes,
  and photo viewing never gate the next chapter. Personal photos peek out of the
  envelope scene and return on a collectible-style keepsake card at the end.
- Animated scrapbook: photo pages unwrap automatically as they become visible.
  Loading and retry states keep unavailable photos from blocking the gift; only
  loaded, visible memories count as revealed. Hearts produce a local mini-burst.
- Letter finale: unfolding stationery, a wax-heart seal, a signature, and an
  optional easy-reading font. The exact message remains intact in both views
  and in the downloadable text keepsake.
- Birthday: an animated envelope, three tappable birthday candles, a confetti
  moment, an occasion countdown, optional memories, and a letter.
- Apology: a quiet flower, honest words, optional memories, and a non-pressuring
  closing. No forced games, forgiveness prompts, or reply requirements.
- Romantic and friendship: original animated pocket-sized characters, a
  tap-to-hug moment, optional hidden notes, a memory scrapbook, and a letter.
- Creator: choose an occasion and one of five visual themes, add names, a
  message, an optional date, and up to five captioned photos in a vertical
  Polaroid-style scrapbook. Recipients scroll down through the same memories
  before reading the note. Add up to three hidden notes (160 characters each),
  optional licensed background music, preview, publish,
  copy, share through WhatsApp/native sharing, or download a QR code.
- Mobile-first: every page is designed for phones. On larger screens the app is
  shown in a centered phone-width frame over a pastel heart background.
- Full recipient preview: play the same experience before publishing, including
  locally selected photos and music. Previewing does not upload or publish the gift.
- Writing help: optional sentence starters append rather than replace a message.
  Changing the occasion preserves custom words. If delivery settings fail to load,
  retry the connection without clearing the in-page form.
- Recipient controls: pause music, adjust volume, pause decorative animations,
  expand photos, download the original letter as text, or replay the gift.
  Photo hearts are local interactions, not reactions sent to the sender.
  All optional surprises can be skipped, and reduced-motion device preferences
  are respected.

### Matching the feeling

New gifts automatically suggest a feeling and palette from the message and
occasion. The five feelings are love, missing someone, happiness, gratitude,
and gentle sincerity. The sender can override either the feeling or palette,
or return to automatic selection. Manually selected colours do not change
while the message is edited. The resolved feeling and theme are saved with
the gift, so its preview and published experience agree.

This is a lightweight, deterministic word matcher, not an AI sentiment model.
It recognises common English and some romanised Hindi phrases; it cannot
reliably interpret sarcasm, every language, or complex emotions. Unrecognised
messages use the occasion as a starting point. No message is sent to an
external AI service, and the sender's actual words are never rewritten.

### Sound

New gifts can include an original music-box melody, synthesised locally with
Web Audio. It can be disabled by the creator. An uploaded MP3, WAV, or OGG track
takes precedence over the music box. Music starts only after a recipient's tap;
it can be paused or adjusted and pauses when the page is hidden. Audio errors
are displayed without blocking the gift. Existing gifts with no song stay silent.
Upload only music you own or are licensed to share. Neither music nor artwork
is copied from the reference websites.

The backend exposes `GET /api/config`, `GET /api/themes`, `POST /api/gifts`,
`PATCH /api/gifts/<id>`, `POST /api/gifts/<id>/media`,
`DELETE /api/gifts/<id>/media/<index>`,
`POST /api/gifts/<id>/music`, `POST /api/gifts/<id>/publish`,
`GET /api/gifts/<slug>`, `POST /api/payments/order`,
`POST /api/payments/verify`, and `POST /api/payments/webhook`. Draft IDs and
published slugs are generated independently with secure random tokens. Drafts
are not available from the public gift lookup route. Uploads are limited to
five images (8 MB each) and one music track (12 MB), with extension and file
signature checks. With neither Razorpay key set, gifts remain free. Supplying
either key turns on the payment requirement; checkout and publishing then stay
blocked until both API credentials are configured.

Gift creation and draft updates also accept optional `feeling`, `secret_notes`,
and `soundtrack` (`music-box` or `silent`, used when no track is uploaded).
Existing gift records remain compatible; no database migration is required.
Anyone with a published link can open it, so share links only with intended
recipients.

### Razorpay payments (India)

Copy `backend/.env.example` as a reference and set environment variables before
starting Flask. Use Razorpay **test keys** first:

```powershell
$env:RAZORPAY_KEY_ID = "rzp_test_..."
$env:RAZORPAY_KEY_SECRET = "..."
$env:RAZORPAY_WEBHOOK_SECRET = "..."
$env:GIFT_PRICE_PAISE = "19900"
$env:GIFT_CURRENCY = "INR"
python app.py
```

`GIFT_PRICE_PAISE` is configurable (19900 means ₹199.00). With both Razorpay keys
present, every gift requires a successfully captured payment before publishing.
If only one key is set, checkout reports the incomplete setup and publishing
remains blocked rather than silently making paid gifts free.
The server creates the order, checks the Razorpay signature, confirms the
captured amount/currency/order with Razorpay, and only then issues the public
gift link. Configure Razorpay auto-capture and, for recovery when a buyer closes
the browser during payment, point a Razorpay webhook at
`/api/payments/webhook` and set its webhook secret. Never use live keys until
you have tested the complete payment flow and refund/support process.

## Validation

```powershell
cd backend
python -m unittest discover -s tests
cd ..\frontend
npm test
npm run typecheck
npm run build
```

The frontend tests use Node's built-in test runner and TypeScript stripping
(Node 22.14 or later). Stop the Next.js dev server before running the production
build because both commands write to `.next`; restart it after the build.

## Production notes

The API uses SQLite and local disk so it runs without external services. Before
deploying, configure persistent database and media storage (for example,
PostgreSQL and S3-compatible storage), HTTPS, backups, request rate limits,
monitoring, and deployment-specific CORS. Never deploy the development Flask
server as the production WSGI server.

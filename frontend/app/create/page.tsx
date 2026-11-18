"use client";

import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, occasions, type Gift, type GiftFeeling, type GiftTheme, type GiftType } from "@/lib/api";
import { feelingOptions, resolveDesign, themeOptions } from "@/lib/feelings";
import GiftExperience from "@/components/GiftExperience";
import { GiftScene } from "@/components/GiftArtwork";

type PaymentConfig = {
  payments_enabled: boolean;
  payments_configured: boolean;
  razorpay_key_id: string | null;
  price_paise: number;
  currency: string;
};

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: string, handler: (event: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout;
  }
}

const defaults: Record<GiftType, string> = {
  birthday: "Happy birthday! I hope your day feels as wonderful as you make every day for the people around you. Here's to more laughs, little adventures, and memories together. You deserve all the lovely things.",
  apology: "I've been thinking about what happened, and I'm truly sorry. I care about you and want to listen, understand, and do better. There's no pressure to reply before you're ready.",
  romantic: "Just a little reminder that life is sweeter with you in it. Thank you for all the ordinary moments that somehow become my favorites. I love doing life alongside you.",
  friendship: "Some of my favorite memories have you in them. Thank you for showing up, making ordinary days brighter, and being my person through it all. Here's to all the little moments still waiting for us.",
};

type Step = 1 | 2 | 3;

const messagePrompts: Record<GiftType, string[]> = {
  romantic: ["My favourite ordinary moment with you is...", "You make me feel...", "One thing I never say enough is..."],
  birthday: ["My wish for your next little chapter is...", "I will always remember the time we...", "You deserve a day full of..."],
  friendship: ["The memory that always makes me smile is...", "Thank you for showing up when...", "Our next little adventure should be..."],
  apology: ["What I want to take responsibility for is...", "I want to understand how you felt when...", "There is no need to reply before you are ready."],
};

function GiftPreview({ gift, onClose }: { gift: Gift; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  return (
    <dialog ref={ref} className="gift-preview-modal" aria-label="Try the recipient experience" onClose={onClose}
      onCancel={(event) => { event.preventDefault(); ref.current?.close(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); ref.current?.close(); } }}
      onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}>
      <div className="preview-banner"><span>Only a preview. Nothing sent yet.</span><button type="button" onClick={() => ref.current?.close()}>Back to editing ×</button></div>
      <GiftExperience gift={gift} preview />
    </dialog>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<GiftType>("birthday");
  const [themeOverride, setThemeOverride] = useState<GiftTheme | null>(null);
  const [feelingOverride, setFeelingOverride] = useState<GiftFeeling | null>(null);
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState(defaults.birthday);
  const [occasionDate, setOccasionDate] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [musicRights, setMusicRights] = useState(false);
  const [musicBox, setMusicBox] = useState(true);
  const [secretNotes, setSecretNotes] = useState(["", "", ""]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [checkoutLoaded, setCheckoutLoaded] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [uploadedPhotoCount, setUploadedPhotoCount] = useState(0);
  const [musicUploaded, setMusicUploaded] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const selectedOccasion = occasions.find((item) => item.type === type)!;
  const design = resolveDesign(message, type, feelingOverride, themeOverride);
  const theme = design.theme;
  const selectedTheme = themeOptions.find((item) => item.id === theme)!;
  const photoPreviews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  const musicPreview = useMemo(() => music ? URL.createObjectURL(music) : "", [music]);

  async function loadPaymentConfig(signal?: AbortSignal) {
    setConfigLoading(true);
    setConfigError("");
    try {
      const response = await fetch(`${API_URL}/api/config`, { signal });
      const config = await response.json();
      if (!response.ok) throw new Error(config.error ?? "Delivery settings couldn't be loaded.");
      if (!signal?.aborted) setPaymentConfig(config as PaymentConfig);
    } catch (cause) {
      if (!signal?.aborted) setConfigError(cause instanceof Error ? cause.message : "Delivery settings couldn't be loaded.");
    } finally {
      if (!signal?.aborted) setConfigLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadPaymentConfig(controller.signal);
    const query = new URLSearchParams(window.location.search);
    const queryType = query.get("type");
    if (queryType === "birthday" || queryType === "apology" || queryType === "romantic" || queryType === "friendship") {
      setType(queryType);
      setMessage(defaults[queryType]);
    }
    const queryFeeling = feelingOptions.find((item) => item.id === query.get("feeling"));
    if (queryFeeling) setFeelingOverride(queryFeeling.id);
    return () => controller.abort();
  }, []);

  useEffect(() => () => photoPreviews.forEach(URL.revokeObjectURL), [photoPreviews]);
  useEffect(() => () => { if (musicPreview) URL.revokeObjectURL(musicPreview); }, [musicPreview]);
  useEffect(() => {
    if (step > 1) headingRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [step]);

  function chooseType(nextType: GiftType) {
    setType(nextType);
    if (!message.trim() || message === defaults[type]) setMessage(defaults[nextType]);
  }

  function addPrompt(prompt: string) {
    const next = `${message.trim()}${message.trim() ? "\n\n" : ""}${prompt}`;
    if (next.length > 1000) {
      setError("Make a little room in your message before adding this prompt (1,000 characters maximum).");
      return;
    }
    setMessage(next);
    setError("");
    messageRef.current?.focus();
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setError("");
    const selected = Array.from(files);
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (selected.some((file) => !supportedTypes.has(file.type))) {
      setError("Please choose JPG, PNG, or WebP image files.");
      return;
    }
    if (selected.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("Each photo needs to be smaller than 8 MB.");
      return;
    }
    const availableSlots = Math.max(0, 5 - photos.length);
    const accepted = selected.slice(0, availableSlots);
    if (accepted.length < selected.length) setError("A little scrapbook can hold up to 5 photos.");
    setPhotos((current) => [...current, ...accepted]);
    setPhotoCaptions((current) => [...current, ...accepted.map(() => "")]);
    if (accepted.length === selected.length) setError("");
  }

  async function removePhoto(index: number) {
    if (index < uploadedPhotoCount && draftId) {
      try {
        const response = await fetch(`${API_URL}/api/gifts/${draftId}/media/${index}`, { method: "DELETE" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "We couldn't remove this photo from your draft.");
        setUploadedPhotoCount((current) => current - 1);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "We couldn't remove this photo from your draft.");
        return;
      }
    }
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoCaptions((current) => current.filter((_, photoIndex) => photoIndex !== index));
  }

  function chooseMusic(file: File | undefined) {
    setError("");
    if (!file) {
      setMusic(null);
      setMusicRights(false);
      setMusicUploaded(false);
      return;
    }
    const supportedTypes = new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/x-wav"]);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!supportedTypes.has(file.type) || !["mp3", "wav", "ogg"].includes(extension ?? "")) {
      setError("Please choose an MP3, WAV, or OGG music file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Music files need to be smaller than 12 MB.");
      return;
    }
    setMusic(file);
    setMusicRights(false);
    setMusicUploaded(false);
  }

  async function finishPublishing(currentDraftId: string) {
    const published = await fetch(`${API_URL}/api/gifts/${currentDraftId}/publish`, { method: "POST" });
    const result = await published.json();
    if (!published.ok) throw new Error(result.error ?? "We couldn't publish your surprise.");
    const url = `${window.location.origin}/gift/${result.slug}`;
    setShareUrl(url);
    setStep(3);
  }

  async function startCheckout(currentDraftId: string) {
    if (!checkoutLoaded || !window.Razorpay || !paymentConfig?.razorpay_key_id) {
      throw new Error("Secure checkout is still loading. Please try again in a moment.");
    }
    const response = await fetch(`${API_URL}/api/payments/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gift_id: currentDraftId }),
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error ?? "We couldn't start checkout.");

    let paymentHandled = false;
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "Little Moments",
      description: `A little surprise for ${recipient}`,
      order_id: order.order_id,
      handler: async (result) => {
        paymentHandled = true;
        setBusy(true);
        setError("");
        try {
          const verified = await fetch(`${API_URL}/api/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
          });
          const verification = await verified.json();
          if (!verified.ok) throw new Error(verification.error ?? "We couldn't verify your payment.");
          await finishPublishing(currentDraftId);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Payment verification failed. Please contact support.");
        } finally {
          setBusy(false);
        }
      },
      modal: {
        ondismiss: () => {
          if (paymentHandled) return;
          setBusy(false);
          setError("Checkout was closed. Your gift is saved; you can try payment again.");
        },
      },
    });
    checkout.on("payment.failed", (event) => {
      setBusy(false);
      setError(event.error?.description ?? "Payment didn't go through. Please try again.");
    });
    checkout.open();
  }

  async function publishGift() {
    if (!paymentConfig) {
      setError("We couldn't confirm whether checkout is enabled. Check the backend connection and try again.");
      return;
    }
    if (!recipient.trim() || !sender.trim() || !message.trim() || (music && !musicRights)) {
      setError(music && !musicRights ? "Confirm you have permission to share this song." : "Add both names and a little message before you publish.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let currentDraftId = draftId;
      if (!currentDraftId) {
        const created = await fetch(`${API_URL}/api/gifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            theme,
            recipient_name: recipient.trim(),
            sender_name: sender.trim(),
            message: message.trim(),
            occasion_date: occasionDate || null,
            photo_captions: photoCaptions,
            feeling: design.feeling,
            secret_notes: secretNotes.filter((note) => note.trim()),
            soundtrack: musicBox ? "music-box" : "silent",
          }),
        });
        const draft = await created.json();
        if (!created.ok) throw new Error(draft.error ?? "We couldn't start your surprise. Please try again.");
        currentDraftId = draft.id as string;
        setDraftId(currentDraftId);
      } else {
        const updated = await fetch(`${API_URL}/api/gifts/${currentDraftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            theme,
            recipient_name: recipient.trim(),
            sender_name: sender.trim(),
            message: message.trim(),
            occasion_date: occasionDate || null,
            photo_captions: photoCaptions,
            feeling: design.feeling,
            secret_notes: secretNotes.filter((note) => note.trim()),
            soundtrack: musicBox ? "music-box" : "silent",
          }),
        });
        const updateResult = await updated.json();
        if (!updated.ok) throw new Error(updateResult.error ?? "We couldn't update your draft.");
      }

      if (photos.length > uploadedPhotoCount) {
        const form = new FormData();
        photos.slice(uploadedPhotoCount).forEach((photo) => form.append("files", photo));
        const uploaded = await fetch(`${API_URL}/api/gifts/${currentDraftId}/media`, {
          method: "POST",
          body: form,
        });
        const uploadResult = await uploaded.json();
        if (!uploaded.ok) throw new Error(uploadResult.error ?? "Your photos couldn't be uploaded.");
        setUploadedPhotoCount(photos.length);
      }

      if (music && !musicUploaded) {
        const form = new FormData();
        form.append("file", music);
        const uploaded = await fetch(`${API_URL}/api/gifts/${currentDraftId}/music`, {
          method: "POST",
          body: form,
        });
        const uploadResult = await uploaded.json();
        if (!uploaded.ok) throw new Error(uploadResult.error ?? "Your music couldn't be uploaded.");
        setMusicUploaded(true);
      }

      if (paymentConfig?.payments_enabled) {
        await startCheckout(currentDraftId);
        return;
      }
      await finishPublishing(currentDraftId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong while publishing.");
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setError("Your browser couldn't copy the link. Select and copy it from the box instead.");
    }
  }

  async function showQrCode() {
    try {
      setQrCode(await QRCode.toDataURL(shareUrl, { width: 240, margin: 2, color: { dark: "#68475A", light: "#FFFFFF" } }));
    } catch {
      setError("We couldn't create a QR code for this link. You can still copy or share the URL.");
    }
  }

  async function shareGift() {
    if (!navigator.share) {
      setError("Link sharing isn't available in this browser. Use WhatsApp or copy the link instead.");
      return;
    }
    try {
      await navigator.share({ title: `A little surprise for ${recipient}`, text: "I made a little surprise for you 💌", url: shareUrl });
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "AbortError") {
        setError("The share sheet couldn't open. Use WhatsApp or copy the link instead.");
      }
    }
  }

  const canContinue = step === 1 || (step === 2 && recipient.trim() && sender.trim() && message.trim() && (!music || musicRights));
  const priceLabel = paymentConfig
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: paymentConfig.currency, maximumFractionDigits: 2 }).format(paymentConfig.price_paise / 100)
    : "";

  return (
    <main className="creator-page" data-theme={theme}>
      {paymentConfig?.payments_configured && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setCheckoutLoaded(true)} onError={() => setError("Secure checkout couldn't load. Check your connection and try again.")} />}
      <nav className="nav-shell creator-nav">
        <Link className="brand" href="/"><span className="brand-mark">♡</span> little moments<span className="brand-period">.</span></Link>
        <Link className="back-link" href="/">← Go back</Link>
      </nav>
      <div className="creator-doodles" aria-hidden="true"><span>♡</span><span>✿</span><span>🎀</span><span>✦</span><span>💌</span></div>
      <section className="creator-shell">
        {shareUrl ? (
          <div className="published-card">
            <span className="published-icon">💌</span>
            <div className="eyebrow"><span className="eyebrow-dot" /> IT&apos;S READY TO SEND</div>
            <h1>Your little moment<br /><em>is ready to bloom.</em></h1>
            <p>We made a tiny surprise for {recipient}. Send their link whenever the moment feels right.</p>
            {paymentConfig?.payments_enabled && <p className="payment-receipt">Payment received · {priceLabel} INR</p>}
            <div className="share-link-box"><span>{shareUrl}</span><button className="button button-primary button-small" onClick={copyLink}>{copied ? "Copied ✓" : "Copy link"}</button></div>
            <a className="button button-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`I made a little surprise for you 💌 ${shareUrl}`)}`} target="_blank" rel="noreferrer">Send with WhatsApp <span aria-hidden="true">↗</span></a>
            <button className="button button-outline share-sheet-button" onClick={shareGift}>Share link <span aria-hidden="true">↗</span></button>
            <div className="qr-actions">
              <button className="text-link" onClick={showQrCode}>{qrCode ? "Refresh QR code" : "Make a QR code"} <span aria-hidden="true">⌗</span></button>
              {qrCode && <><Image className="share-qr" src={qrCode} alt={`QR code for ${recipient}'s gift link`} width={180} height={180} unoptimized /><a className="text-link" href={qrCode} download="little-moment-qr.png">Download QR code <span aria-hidden="true">↓</span></a></>}
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="text-link preview-link" onClick={() => router.push(`/gift/${new URL(shareUrl).pathname.split("/").pop()}`)}>Preview their surprise <span aria-hidden="true">→</span></button>
            <Link className="text-link" href="/create">Make another little moment <span aria-hidden="true">↗</span></Link>
          </div>
        ) : (
          <>
            <div className="creator-heading" ref={headingRef}>
              <div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE SURPRISE, FROM YOUR HEART</div>
              <h1>Let&apos;s make them<br /><em>feel extra loved.</em></h1>
              <p>Your words lead the way. We&apos;ll add the little magic. ♡</p>
            </div>
            <div className="wizard-progress" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((number) => <div className={`progress-step ${step >= number ? "is-current" : ""}`} key={number}><span>{step > number ? "✓" : `0${number}`}</span><small>{number === 1 ? "The feeling" : number === 2 ? "The details" : "The preview"}</small></div>)}
            </div>

            {step === 1 && <section className="wizard-panel">
              <div className="panel-heading"><span className="panel-count">01</span><div><h2>What kind of moment?</h2><p>Pick the feeling you want to send.</p></div></div>
              <div className="type-options">
                {occasions.map((item) => <button type="button" onClick={() => chooseType(item.type)} className={`type-option ${item.className} ${type === item.type ? "selected" : ""}`} key={item.type} aria-pressed={type === item.type}><span className="type-emoji">{item.emoji}</span><span><b>{item.title}</b><small>{item.description}</small></span><span className="radio-mark">{type === item.type ? "✓" : ""}</span></button>)}
              </div>
              <div className="creator-scene-preview">
                <GiftScene feeling={type === "apology" ? "gentle" : design.feeling} still />
                <div><small>A PEEK AT THEIR LITTLE WORLD</small><b>{design.profile.label}</b><p>Your colours. A little character. A lot of feeling.</p></div>
              </div>
              <div className="panel-heading theme-heading"><span className="panel-count">02</span><div><h2>A little world that feels like you</h2><p>Let the message set the colours, or choose your own.</p></div></div>
              <label className="auto-theme-toggle"><input type="checkbox" checked={themeOverride === null} onChange={(event) => setThemeOverride(event.target.checked ? null : theme)} /><span><b>Let my words choose the colours</b><small>The palette will follow the feeling as you write.</small></span><span aria-hidden="true">✧</span></label>
              <div className="theme-options">
                {themeOptions.map((item) => <button type="button" className={`theme-option ${theme === item.id ? "selected" : ""}`} onClick={() => setThemeOverride(item.id)} key={item.id} aria-pressed={theme === item.id}><span className="theme-swatch" style={{ background: item.color }}>{item.icon}</span><b>{item.name}</b><small>{item.detail}</small></button>)}
              </div>
              <p className="theme-selection-note">{themeOverride ? `You chose ${selectedTheme.name}. Your colours will stay put.` : `Starting with ${selectedTheme.name}. Add your words on the next step.`}</p>
            </section>}

            {step === 2 && <section className="wizard-panel">
              <div className="panel-heading"><span className="panel-count">03</span><div><h2>Who&apos;s this little moment for?</h2><p>We&apos;ll make it feel like it belongs to them.</p></div></div>
              <div className="form-grid">
                <label className="field"><span>Their name</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} maxLength={60} placeholder="e.g. Alex" autoComplete="off" /></label>
                <label className="field"><span>Your name</span><input value={sender} onChange={(event) => setSender(event.target.value)} maxLength={60} placeholder="e.g. Sam" autoComplete="off" /></label>
              </div>
              <label className="field occasion-date-field"><span>Make it for a special date <small>(optional)</small></span><input type="date" value={occasionDate} onChange={(event) => setOccasionDate(event.target.value)} /></label>
              <label className="field message-field"><span>A note from your heart <small>(up to 1,000 characters)</small></span><textarea ref={messageRef} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} rows={6} /><span className="character-count">{message.length}/1000</span></label>
              <details className="writing-prompts"><summary>Not sure how to say it? A little nudge ♡</summary><p>Tap a sentence starter, then make it yours. Your words won&apos;t be replaced.</p><div>{messagePrompts[type].map((prompt) => <button type="button" key={prompt} onClick={() => addPrompt(prompt)}>{prompt} <span aria-hidden="true">＋</span></button>)}</div></details>
              <section className={`feeling-match gift-theme-${theme}`} aria-label="Message feeling match">
                <div className="feeling-match-heading"><span aria-hidden="true">{design.profile.icon}</span><div><small>{design.automaticFeeling ? "A FEELING TO START WITH" : "YOUR HANDPICKED FEELING"}</small><h3>{design.profile.label}</h3></div></div>
                <p>{design.reason}</p>
                <p>{design.profile.description}</p>
                <fieldset className="feeling-choices"><legend>What should it feel like?</legend><button type="button" aria-pressed={feelingOverride === null} onClick={() => setFeelingOverride(null)}>✧ Automatic</button>{feelingOptions.map((item) => <button type="button" key={item.id} aria-pressed={feelingOverride === item.id} onClick={() => setFeelingOverride(item.id)}>{item.icon} {item.label}</button>)}</fieldset>
                {themeOverride && <p className="manual-theme-notice">Colours: {selectedTheme.name} (you chose). <button type="button" onClick={() => setThemeOverride(null)}>Use matching colours instead</button></p>}
                <small className="feeling-disclaimer">A simple word match on this device, not an AI judgement. It can miss nuance. You know them best.</small>
              </section>
              <details className="secret-note-editor">
                <summary><span>✉ Hide a few little notes<small>Optional · {secretNotes.filter((note) => note.trim()).length} of 3 tucked inside</small></span><span aria-hidden="true">＋</span></summary>
                <p>An inside joke, a tiny thank-you, or something you wish you said more. They&apos;ll tap to unfold each one.</p>
                {secretNotes.map((note, index) => <label className="field" key={index}><span>Little note {index + 1} <small>({note.length}/160)</small></span><textarea rows={2} maxLength={160} value={note} placeholder={type === "apology" ? ["Something I understand now...", "Something I want to do better...", "Something I appreciate about you..."][index] : ["The little thing you do that I love...", "That one memory only we understand...", "Something I never say enough..."][index]} onChange={(event) => setSecretNotes((current) => current.map((value, noteIndex) => noteIndex === index ? event.target.value : value))} /></label>)}
              </details>
              <div className="upload-area">
                <div className="memory-gallery-heading">
                  <div><h3>Fill your little scrapbook</h3><p>Every photo is a page in your story. Add a caption to each one.</p></div>
                  <span className="memory-page-count">{photos.length} / 5</span>
                </div>
                <div className="memory-card-stack" aria-label="Your photo memory cards">
                  {photoPreviews.map((src, index) => <article className={`memory-card memory-card-${index % 4}`} key={src}>
                    <div className="memory-photo">
                      <Image src={src} alt={`Your photo memory ${index + 1}`} fill sizes="(max-width: 480px) 80vw, 330px" unoptimized />
                      <span className="memory-number">MEMORY 0{index + 1}</span>
                      <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => removePhoto(index)}>×</button>
                    </div>
                    <label className="memory-caption">
                      <span aria-hidden="true">♡</span>
                      <input
                        className="memory-caption-input"
                        aria-label={`Caption for memory ${index + 1}`}
                        placeholder="Add a little caption…"
                        maxLength={100}
                        value={photoCaptions[index] ?? ""}
                        onChange={(event) => setPhotoCaptions((current) => current.map((caption, captionIndex) => captionIndex === index ? event.target.value : caption))}
                      />
                      <span aria-hidden="true">✿</span>
                    </label>
                  </article>)}
                  {photos.length < 5 && <label className="memory-card memory-add-card">
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addPhotos(event.target.files); event.currentTarget.value = ""; }} />
                    <span className="memory-add-heart">＋</span><b>Add a memory</b><small>Choose photos from your device</small><span className="memory-add-count">{photos.length} of 5 photos</span>
                  </label>}
                </div>
              </div>
              <div className="music-upload">
                <label className="auto-theme-toggle music-box-option"><input type="checkbox" checked={musicBox} onChange={(event) => setMusicBox(event.target.checked)} /><span><b>Include a little music-box tune</b><small>An original, gentle melody when no song is uploaded. Starts only after they tap.</small></span><span aria-hidden="true">♫</span></label>
                <label className="upload-label"><span className="upload-icon">♫</span><span><b>Add your own background song</b><small>MP3, WAV, or OGG · up to 12 MB · plays after they tap</small></span><span className="button button-outline button-small">{music ? "Choose another" : "Choose a song"}<input className="music-file-input" type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" onChange={(event) => chooseMusic(event.target.files?.[0])} /></span></label>
                {music && <div className="music-preview"><span>♫ {music.name}</span><audio src={musicPreview} controls preload="metadata" aria-label="Preview background song" /></div>}
                {music && <label className="rights-confirm"><input type="checkbox" checked={musicRights} onChange={(event) => setMusicRights(event.target.checked)} /><span>I own this track or have permission to share it with my recipient.</span></label>}
              </div>
            </section>}

            {step === 3 && <section className="wizard-panel review-panel">
              <div className="panel-heading"><span className="panel-count">04</span><div><h2>A peek at their surprise</h2><p>One last look before you send a little magic.</p></div></div>
              <button type="button" className="play-preview-button" onClick={() => setPreviewOpen(true)}><span aria-hidden="true">▷</span><span>Try their whole experience<small>Open it, play it, feel it. Nothing published yet.</small></span><span aria-hidden="true">↗</span></button>
              <div className={`review-card ${selectedOccasion.className} gift-theme-${theme}`}><span className="review-sticker">{selectedOccasion.emoji}</span><span className="eyebrow">A LITTLE MOMENT FOR {recipient || "SOMEONE SPECIAL"}</span><h3>{type === "birthday" ? `Happy birthday, ${recipient || "friend"}!` : type === "apology" ? `A little note for ${recipient || "you"}` : type === "friendship" ? `A little scrapbook for ${recipient || "my friend"}.` : `Just for you, ${recipient || "my favorite"}.`}</h3><p className="review-message">{message || "Your heartfelt message will show here."}</p><span className="letter-sign">with love, {sender || "someone special"} ♡</span>{photoPreviews.length > 0 && <div className="review-photo-strip">{photoPreviews.map((src, index) => <figure className="review-polaroid" key={src}><Image src={src} alt={`Memory ${index + 1}`} width={136} height={126} unoptimized /><figcaption>{photoCaptions[index]?.trim() || `little memory 0${index + 1} ♡`}</figcaption></figure>)}</div>}<span className="review-theme">{design.profile.icon} {design.profile.label} · {selectedTheme.name}</span>{(music || musicBox) && <span className="review-theme">♫ {music ? "Their own background song" : "An original music-box melody"}</span>}{secretNotes.some((note) => note.trim()) && <span className="review-theme">✉ {secretNotes.filter((note) => note.trim()).length} little notes to unfold</span>}{occasionDate && <span className="review-theme">♡ Made for {new Date(`${occasionDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>}</div>
              <p className="privacy-note"><span>🔒</span> Anyone with the gift link can open it. Share it only with the people you choose.</p>
            </section>}

            {error && <p className="form-error" role="alert">{error}</p>}
            {!paymentConfig && <div className="config-retry"><p role={configError ? "alert" : "status"}>{configError ? `${configError} Your words are still here. Retry without starting over.` : "Checking delivery options..."}</p><button type="button" className="text-link" disabled={configLoading} onClick={() => void loadPaymentConfig()}>{configLoading ? "Connecting..." : "Retry connection"}</button></div>}
            {paymentConfig?.payments_enabled && !paymentConfig.payments_configured && <p className="form-error" role="alert">Checkout is not ready yet. Ask the site owner to configure both Razorpay keys.</p>}
            <div className="wizard-actions">
              {step > 1 && <button className="button button-outline" disabled={busy} onClick={() => { setError(""); setStep((step - 1) as Step); }}>← Back</button>}
              {step < 3 ? <button className="button button-primary" disabled={!canContinue} onClick={() => { setError(""); setStep((step + 1) as Step); }}>{step === 1 ? "Add the little details" : "Preview the surprise"} <span aria-hidden="true">→</span></button> : <button className="button button-primary" disabled={busy || !paymentConfig || Boolean(paymentConfig.payments_enabled && !paymentConfig.payments_configured)} onClick={publishGift}>{busy ? "Wrapping up your surprise…" : paymentConfig?.payments_enabled ? `Pay ${priceLabel} & publish` : "Make their surprise"} <span aria-hidden="true">♡</span></button>}
            </div>
            <p className="creator-footnote">{!paymentConfig ? "You can finish writing and preview while we reconnect." : paymentConfig.payments_enabled ? `A little moment costs ${priceLabel}. Secure checkout by Razorpay. ♡` : "No payment, account, or perfect words needed. Just you. ♡"}</p>
          </>
        )}
      </section>
      {previewOpen && <GiftPreview onClose={() => setPreviewOpen(false)} gift={{
        type, theme, feeling: design.feeling,
        recipient_name: recipient.trim(), sender_name: sender.trim(), message: message.trim(),
        media: photoPreviews, photo_captions: photoCaptions, secret_notes: secretNotes,
        music_url: musicPreview || null, soundtrack: musicBox ? "music-box" : "silent",
        occasion_date: occasionDate || null,
      }} />}
      <footer className="footer-shell"><Link className="brand" href="/"><span className="brand-mark">♡</span> little moments<span className="brand-period">.</span></Link><span>Made with a little extra love.</span><span>Every feeling deserves a moment.</span></footer>
    </main>
  );
}

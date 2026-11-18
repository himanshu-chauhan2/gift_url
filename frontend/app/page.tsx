import Link from "next/link";
import { occasions } from "@/lib/api";
import FeelingDemo from "@/components/FeelingDemo";

export default function Home() {
  return (
    <main className="home-page feeling-home">
      <nav className="nav-shell">
        <Link className="brand" href="/" aria-label="Little Moments home">
          <span className="brand-mark">♡</span>
          little moments<span className="brand-period">.</span>
        </Link>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#occasions">Occasions</a>
        </div>
        <Link className="button button-small button-outline" href="/create">
          Make a surprise <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section className="hero" id="try-a-feeling">
        <FeelingDemo />
      </section>

      <section className="feeling-features section-shell" aria-label="The little details">
        <div><span aria-hidden="true">✉</span><p><b>A surprise, not a plain link</b><small>Unfold an envelope. Find their little notes.</small></p></div>
        <div><span aria-hidden="true">♫</span><p><b>A soundtrack to the feeling</b><small>Our original music box, or a song that&apos;s yours.</small></p></div>
        <div><span aria-hidden="true">♡</span><p><b>Your words set the mood</b><small>Romantic, joyful, grateful, or a little gentler.</small></p></div>
      </section>

      <section className="occasion-section section-shell" id="occasions">
        <div className="section-heading">
          <div><div className="eyebrow"><span className="eyebrow-dot" /> PICK A LITTLE FEELING</div><h2>Little reasons<br /><em>to make them smile.</em></h2></div>
          <p>Choose the feeling you want to send.<br />We&apos;ll help you wrap it up in a moment.</p>
        </div>
        <div className="occasion-grid">
          {occasions.map((occasion, index) => (
            <Link href={`/create?type=${occasion.type}`} className={`occasion-card ${occasion.className}`} key={occasion.type}>
              <span className="occasion-number">0{index + 1}</span>
              <span className="occasion-emoji">{occasion.emoji}</span>
              <span className="occasion-arrow" aria-hidden="true">↗</span>
              <h3>{occasion.title}</h3><p>{occasion.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-shell how-inner">
          <div className="how-intro">
            <div className="eyebrow"><span className="eyebrow-dot" /> NO RIBBON REQUIRED</div>
            <h2>Small steps.<br /><em>Big happy tears.</em></h2>
            <p>Thoughtful doesn&apos;t have to be complicated. Make a moment that feels a little bit like you.</p>
            <Link className="button button-primary" href="/create">Make their moment <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="steps-list">
            <div className="step-row"><span className="step-number">01</span><span className="step-icon">🌷</span><div><h3>Pick your kind of moment</h3><p>Birthday, friendship, apology, or just a little love note.</p></div><span className="step-arrow">↗</span></div>
            <div className="step-row"><span className="step-number">02</span><span className="step-icon">✍️</span><div><h3>Let your words lead</h3><p>Add photos and little notes. The colours follow the feeling.</p></div><span className="step-arrow">↗</span></div>
            <div className="step-row"><span className="step-number">03</span><span className="step-icon">🎁</span><div><h3>Send a little surprise</h3><p>Share their one-of-a-kind link. Let the smiles begin.</p></div><span className="step-arrow">↗</span></div>
          </div>
        </div>
      </section>

      <section className="little-questions section-shell">
        <div className="eyebrow">A FEW LITTLE ANSWERS</div>
        <h2>Simple, from the heart.</h2>
        <details><summary>Will it really feel personal?</summary><p>Your names, your photos, your captions, and your exact words are the gift. Optional hidden notes make room for the things only the two of you understand.</p></details>
        <details><summary>How does the theme match my message?</summary><p>A simple word matcher suggests a feeling and colours from your message and occasion, right on your device. It can miss nuance, so you can always pick something else. Your message isn&apos;t sent to an AI service.</p></details>
        <details><summary>Can I try it before I send it?</summary><p>Yes. Open the full recipient preview before publishing. Try the music, the little surprises, and the vertical photo scrapbook. Then share the link when it feels right.</p></details>
        <details><summary>Do they need an app or an account?</summary><p>No. They just open the link on their phone. Music starts only after a tap, animations can be paused, and every interaction is optional.</p></details>
      </section>

      <section className="closing-cta">
        <span className="cta-flower">✿</span><span className="cta-heart">♡</span>
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT FAVORITE MEMORY STARTS HERE</div>
        <h2>Someone you love<br />is waiting for <em>a little magic.</em></h2>
        <Link className="button button-primary" href="/create">Create their surprise <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="footer-shell"><Link className="brand" href="/"><span className="brand-mark">♡</span> little moments<span className="brand-period">.</span></Link><span>Made with a little extra love. © {new Date().getFullYear()}</span><span>Every feeling deserves a moment.</span></footer>
    </main>
  );
}

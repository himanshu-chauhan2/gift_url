"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { assetUrl, type Gift } from "@/lib/api";
import { feelings, matchFeeling } from "@/lib/feelings";
import { AmbientDecor, Envelope, GiftScene, HeartBurst, HeartMark } from "./GiftArtwork";
import { useGiftAudio } from "./useGiftAudio";
import { useGiftMotion } from "./useGiftMotion";
import styles from "./GiftExperience.module.css";

type Stage = "welcome" | "interaction" | "memories" | "letter" | "complete";

function GiftPhoto({ photo, alt, className, sizes, expand, onReady }: {
  photo: string; alt: string; className: string; sizes: string;
  expand?: { label: string; onClick: () => void }; onReady?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return <div className={`${styles.photoFrame} ${className}`} data-status={status} aria-busy={status === "loading"}>
    <Image key={attempt} src={assetUrl(photo)} alt={alt} fill sizes={sizes} unoptimized
      onLoad={(event) => {
        if (!event.currentTarget.naturalWidth) { setStatus("error"); return; }
        setStatus("ready");
        onReady?.();
      }}
      onError={() => setStatus("error")} />
    {status !== "ready" && <div className={styles.photoStatus} role={status === "error" ? "status" : undefined}>
      <span aria-hidden="true">{status === "error" ? "↻" : "♡"}</span>
      <p>{status === "error" ? "This photo couldn't load." : "A little memory is on its way..."}</p>
      {status === "error" && <button type="button" onClick={() => { setStatus("loading"); setAttempt(value => value + 1); }}>Try this photo again</button>}
    </div>}
    {expand && <button type="button" className={styles.photoExpand} disabled={status !== "ready"} onClick={expand.onClick} aria-label={expand.label}><span className={styles.expandHint} aria-hidden="true">↗</span></button>}
  </div>;
}

function GiftContents({ photos, notes }: { photos: number; notes: number }) {
  return <ul className={styles.contentsPreview} aria-label="Inside your surprise">
    {photos > 0 && <li><span aria-hidden="true">▧</span>{photos} {photos === 1 ? "memory" : "memories"}</li>}
    {notes > 0 && <li><span aria-hidden="true">✉</span>{notes} little {notes === 1 ? "note" : "notes"}</li>}
    <li><span aria-hidden="true">♡</span>one heartfelt letter</li>
  </ul>;
}

function MemoryCard({ photo, caption, index, sender, onExpand, onReveal }: {
  photo: string; caption: string; index: number; sender: string; onExpand: () => void; onReveal: (index: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [arrived, setArrived] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loved, setLoved] = useState(false);
  useEffect(() => {
    const card = ref.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setArrived(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (arrived && loaded) onReveal(index);
  }, [arrived, loaded, index, onReveal]);

  return (
    <figure className={styles.memoryCard} ref={ref} data-arrived={arrived} data-ready={loaded}>
      <span className={styles.tape} aria-hidden="true" />
      <div className={styles.memoryWindow}>
        <GiftPhoto photo={photo} alt={`Memory ${index + 1} shared by ${sender}`} className={styles.memoryPhoto} sizes="(max-width: 480px) 85vw, 360px" expand={{ label: `View full photo ${index + 1}`, onClick: onExpand }} onReady={() => setLoaded(true)} />
        <span className={styles.memoryReveal} aria-hidden="true"><HeartMark /><span>a little moment, unwrapped</span></span>
        <span className={styles.memoryNumber}>little memory {String(index + 1).padStart(2, "0")}</span>
      </div>
      <figcaption>
        <span>{caption || "A moment worth keeping."}</span>
        <button type="button" className={styles.memoryLove} aria-label={`Love memory ${index + 1}`} aria-pressed={loved} onClick={() => setLoved(!loved)}>{loved ? "♥" : "♡"}</button>
      </figcaption>
      {loved && <div className={styles.memoryReaction}><HeartBurst count={8} /></div>}
    </figure>
  );
}

function PhotoDialog({ photo, caption, onClose }: { photo: string; caption: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className={styles.photoDialog}
      onClose={(event) => { event.stopPropagation(); onClose(); }}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); ref.current?.close(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); ref.current?.close(); } }}
      onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}
      aria-label="Full photo">
      <button type="button" className={styles.closePhoto} onClick={() => ref.current?.close()} aria-label="Close full photo">×</button>
      <GiftPhoto key={photo} photo={photo} alt={caption || "Your full-size memory"} className={styles.fullPhoto} sizes="95vw" />
      {caption && <p>{caption}</p>}
    </dialog>
  );
}

export default function GiftExperience({ gift, preview = false }: { gift: Gift; preview?: boolean }) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [opened, setOpened] = useState(false);
  const [candles, setCandles] = useState<number[]>([]);
  const [hugged, setHugged] = useState(false);
  const [openNotes, setOpenNotes] = useState<number[]>([]);
  const [burst, setBurst] = useState(0);
  const [revealedMemories, setRevealedMemories] = useState<number[]>([]);
  const [easyReading, setEasyReading] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<number | null>(null);
  const { motionPaused, setMotionPaused, systemReducedMotion, reducedMotion } = useGiftMotion();
  const [downloadNotice, setDownloadNotice] = useState("");
  const [today, setToday] = useState(() => new Date());
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousStage = useRef<Stage>("welcome");
  const noteId = useId();
  const feeling = gift.feeling ?? matchFeeling(gift.message, gift.type).id;
  const profile = feelings[feeling];
  const gentle = gift.type === "apology" || feeling === "gentle";
  const music = useGiftAudio(gift.music_url, gift.soundtrack === "music-box", feeling);
  const notes = gift.secret_notes?.filter((note) => note.trim()) ?? [];
  const stages: { id: Stage; label: string }[] = [
    { id: "welcome", label: "For you" },
    { id: "interaction", label: "Little things" },
    ...(gift.media.length ? [{ id: "memories" as const, label: "Memories" }] : []),
    { id: "letter", label: "The letter" },
    { id: "complete", label: "Keep it" },
  ];
  const stageIndex = stages.findIndex((item) => item.id === stage);
  const revealMemory = useCallback((index: number) => setRevealedMemories(current => current.includes(index) ? current : [...current, index]), []);
  const nextLabels: Record<Stage, string> = {
    welcome: opened ? "Unfolding your moment..." : gentle ? "Open when you're ready" : "Open my little surprise",
    interaction: gift.media.length ? "Wander through our memories" : "Read the words they wrote",
    memories: "There's a letter for you",
    letter: "Keep this feeling",
    complete: "Save their words",
  };
  const nextHints: Record<Stage, string> = {
    welcome: gentle ? "A few honest words, at your own pace." : "An envelope. A little magic. All for you.",
    interaction: gift.media.length ? "Next up: the moments worth keeping" : "Next up: their words, just for you",
    memories: `${revealedMemories.length} of ${gift.media.length} memories revealed · the letter is ready`,
    letter: "One last little thing to keep",
    complete: "A keepsake you can read whenever you need it",
  };

  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => {
      clearInterval(timer);
      if (openingTimer.current) clearTimeout(openingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (previousStage.current === stage) return;
    previousStage.current = stage;
    const scroller = preview ? rootRef.current?.closest("dialog") : window;
    scroller?.scrollTo({ top: 0, behavior: "instant" });
    headingRef.current?.focus({ preventScroll: true });
  }, [stage, preview]);

  function goToStage(next: Stage) {
    if (openingTimer.current) {
      clearTimeout(openingTimer.current);
      openingTimer.current = null;
    }
    if (next === "welcome") { setOpened(false); music.pause(); }
    setDownloadNotice("");
    setFullPhoto(null);
    setStage(next);
  }

  function begin() {
    if (opened) return;
    setOpened(true);
    void music.start();
    openingTimer.current = setTimeout(() => goToStage("interaction"), reducedMotion ? 0 : 1250);
  }

  function continueStory() {
    switch (stage) {
      case "welcome": begin(); break;
      case "interaction": goToStage(gift.media.length ? "memories" : "letter"); break;
      case "memories": goToStage("letter"); break;
      case "letter":
        goToStage("complete");
        if (!gentle) setBurst(value => value + 1);
        break;
      case "complete": saveLetter(); break;
    }
  }

  function replay() {
    music.pause();
    setOpened(false);
    setCandles([]);
    setHugged(false);
    setOpenNotes([]);
    setBurst(0);
    setRevealedMemories([]);
    goToStage("welcome");
  }

  function saveLetter() {
    const container = rootRef.current;
    if (!container) {
      setDownloadNotice("The letter isn't ready to download. Please try again.");
      return;
    }
    const text = `Dear ${gift.recipient_name},\n\n${gift.message}\n\nWith care,\n${gift.sender_name}\n\n${notes.length ? `Little notes:\n${notes.map((note) => `- ${note}`).join("\n")}\n\n` : ""}Made with Little Moments`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "little-moments-letter.txt";
    container.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadNotice("Your letter download has started. Keep it somewhere lovely.");
  }

  const occasionDay = gift.occasion_date ? new Date(`${gift.occasion_date}T00:00:00`) : null;
  const days = occasionDay ? Math.ceil((occasionDay.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000) : null;

  return (
    <section ref={rootRef} className={styles.world} data-theme={gift.theme} data-feeling={feeling} data-stage={stage} data-reduced={reducedMotion} data-gentle={gentle} aria-label="Your little moment">
      {music.audio && <audio {...music.audio} loop preload="none" onPlay={music.onPlay} onPause={music.onPause} onError={music.onError} />}
      <AmbientDecor icon={profile.icon} />
      <header className={styles.toolbar}>
        {preview ? <span className={styles.brand}>♡ recipient preview</span> : <Link className={styles.brand} href="/">♡ little moments</Link>}
        <div className={styles.toolbarActions}>
          {music.available && <button type="button" className={styles.iconButton} disabled={music.starting} onClick={() => music.playing ? music.pause() : void music.start()} aria-label={music.playing ? "Pause music" : "Play music"} aria-pressed={music.playing}><span aria-hidden="true">{music.playing ? "Ⅱ" : "♫"}</span></button>}
          <button type="button" className={styles.iconButton} onClick={() => setMotionPaused(!motionPaused)} aria-label={systemReducedMotion ? "Reduced motion from device settings" : motionPaused ? "Resume animations" : "Pause animations"} aria-pressed={reducedMotion} disabled={systemReducedMotion}><span aria-hidden="true">{reducedMotion ? "○" : "✧"}</span></button>
        </div>
      </header>
      <div className={styles.journey}>
        <div className={styles.chapterMeta}>
          <span><b>{String(stageIndex + 1).padStart(2, "0")}</b> / {String(stages.length).padStart(2, "0")} <span>{stages[stageIndex].label}</span></span>
          {stage !== "letter" && stage !== "complete" && <button type="button" className={styles.jumpLetter} onClick={() => goToStage("letter")}>Go straight to the letter ↗</button>}
        </div>
        <ol className={styles.progress} aria-label="Your gift journey">
          {stages.map((item, index) => <li key={item.id} aria-current={stage === item.id ? "step" : undefined} data-done={index < stageIndex}><span className={styles.srOnly}>{item.label}</span></li>)}
        </ol>
        {music.available && <div className={styles.soundRow}><span className={styles.soundBars} data-playing={music.playing} aria-hidden="true"><i /><i /><i /></span><span>{music.playing ? "A little soundtrack to your moment" : "Sound is optional. Your moment, your way."}</span>{music.playing && <label><span className={styles.srOnly}>Music volume</span><input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={music.volume} onChange={(event) => music.setVolume(Number(event.target.value))} /></label>}</div>}
        {music.notice && <p className={styles.notice} role="status">{music.notice}</p>}

        <div className={styles.stage} key={stage}>
          {stage === "welcome" && <>
            <span className={styles.kicker}>ONE PERSON. ONE LITTLE WORLD.</span>
            <h1 className={styles.title} ref={headingRef} tabIndex={-1}>{gift.type === "birthday" ? "It's a little celebration," : "Psst... this one's for you,"}<em>{gift.recipient_name}.</em></h1>
            <p className={styles.intro}>{profile.welcome}</p>
            <div className={styles.delivery}><GiftScene feeling={gentle ? "gentle" : feeling} celebrate={opened ? 1 : 0} photos={gift.media} delivery>
              <Envelope name={gift.recipient_name} open={opened} onOpen={begin} label="Open your personal envelope" />
            </GiftScene></div>
            <span className={styles.handwritten}>{gentle ? "a few words, when you're ready" : "a special delivery for your heart ♡"}</span>
            {days !== null && <p className={styles.dateBadge}>{days > 1 ? `${days} little sleeps until your special day` : days === 1 ? "Just one little sleep to go" : days === 0 ? "Your special day is here!" : "A moment to celebrate, always"}</p>}
            <GiftContents photos={gift.media.length} notes={notes.length} />
            <p className={styles.from}>made just for you, by <strong>{gift.sender_name}</strong></p>
          </>}

          {stage === "interaction" && <>
            <span className={styles.kicker}>{gentle ? "A LITTLE ROOM TO BREATHE" : gift.type === "birthday" ? "A WISH BEFORE THE WORDS" : "THE LITTLE THINGS ARE THE BIG THINGS"}</span>
            <h1 className={styles.title} ref={headingRef} tabIndex={-1}>{gentle ? "No perfect moment needed." : gift.type === "birthday" ? "Make a tiny wish." : feeling === "longing" ? "A little closer, for a moment." : "A pocketful of happy."}</h1>
            {gift.type === "birthday" && !gentle ? <>
              <p className={styles.intro}>Tap the three candles. Keep the wish all to yourself.</p>
              <div className={styles.cakeScene}>
                <div className={styles.candles}>{[0, 1, 2].map((index) => <button className={styles.candle} key={index} type="button" data-out={candles.includes(index)} disabled={candles.includes(index)} aria-label={`Blow out candle ${index + 1}`} onClick={() => {
                  setCandles((current) => [...current, index]);
                  if (candles.length === 2) setBurst((current) => current + 1);
                }}><span className={styles.flame} /><span className={styles.wick} /><span className={styles.candleStick} /></button>)}</div>
                <div className={styles.cake}><span className={styles.icing} /><span className={styles.cakeHeart}>♡</span></div>
                <div className={styles.cakePlate} />
              </div>
              <p className={styles.handwritten} role="status">{candles.length === 3 ? "A wish made. A little joy kept. ✨" : `${3 - candles.length} little ${candles.length === 2 ? "light" : "lights"} left`}</p>
            </> : gentle ? <>
              <GiftScene feeling="gentle" />
              <p className={styles.intro}>Read a little. Pause a little. There is nothing you need to do in return.</p>
            </> : <>
              <GiftScene feeling={feeling} hugged={hugged} celebrate={hugged ? burst : 0} />
              <button type="button" className={styles.hugButton} aria-pressed={hugged} onClick={() => { setHugged(!hugged); if (!hugged) setBurst((current) => current + 1); }}>{hugged ? "A little hug, right here ♡" : "Tap for a pocket-sized hug ♡"}</button>
              <p className={styles.smallCopy}>No distance is too big for a little thought.</p>
            </>}

            {notes.length > 0 && <div className={styles.notes}>
              <h2>Little notes from {gift.sender_name}</h2>
              <p>There&apos;s a thought tucked inside each one. <span className={styles.notesCount}>{openNotes.length} / {notes.length} unfolded</span></p>
              {notes.map((note, index) => <div className={styles.note} key={index} data-open={openNotes.includes(index)}>
                <button type="button" aria-expanded={openNotes.includes(index)} aria-controls={`${noteId}-${index}`} onClick={() => setOpenNotes((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])}><span aria-hidden="true">{openNotes.includes(index) ? "♡" : "✉"}</span><span>Little note {String(index + 1).padStart(2, "0")}<small>{openNotes.includes(index) ? "a thought, just for you" : "tap to unfold"}</small></span><span aria-hidden="true">{openNotes.includes(index) ? "−" : "+"}</span></button>
                <div id={`${noteId}-${index}`} hidden={!openNotes.includes(index)}><p>{note}</p></div>
              </div>)}
            </div>}
            <p className={styles.smallCopy}>Stay a while or keep going. Nothing to unlock.</p>
          </>}

          {stage === "memories" && <>
            <span className={styles.kicker}>A LITTLE SCRAPBOOK, MADE FOR YOU</span>
            <h1 className={styles.title} ref={headingRef} tabIndex={-1}>Ordinary moments.<em>Extraordinary us.</em></h1>
            <p className={styles.intro}>{gift.media.length} {gift.media.length === 1 ? "memory" : "memories"} to keep. Scroll down, one little page at a time.</p>
            <div className={styles.memoryStack} aria-label="Photo memories">
              {gift.media.map((photo, index) => <MemoryCard key={`${index}-${photo}`} photo={photo} caption={gift.photo_captions?.[index] ?? ""} index={index} sender={gift.sender_name} onExpand={() => setFullPhoto(index)} onReveal={revealMemory} />)}
            </div>
            <p className={styles.smallCopy}>Tap a photo to see it all. Hearts are just for you; no reaction is sent.</p>
            <p className={styles.handwritten}>The photos end. The feeling doesn&apos;t. ♡</p>
          </>}

          {stage === "letter" && <>
            <span className={styles.kicker}>NO PERFECT WORDS NEEDED. JUST THEIRS.</span>
            <h1 className={styles.title} ref={headingRef} tabIndex={-1}>The part that matters.<em>Every little word.</em></h1>
            <button type="button" className={styles.readingToggle} aria-pressed={easyReading} onClick={() => setEasyReading(!easyReading)}><span aria-hidden="true">Aa</span>{easyReading ? "Show handwriting" : "Easy-reading view"}</button>
            <div className={styles.letter} data-readable={easyReading}>
              <span className={styles.letterFlower} aria-hidden="true">❀</span>
              <span className={styles.letterLabel}>A LETTER TO KEEP</span>
              <p className={styles.letterTo}>Dear {gift.recipient_name},</p>
              <p className={styles.letterBody}>{gift.message}</p>
              <p className={styles.letterSignature}>{gentle ? "With care," : "With a little extra love,"}<br /><strong>{gift.sender_name} ♡</strong></p>
              <span className={styles.letterSeal} aria-hidden="true"><HeartMark /></span>
            </div>
            <p className={styles.handwritten}>Some words deserve a place to stay.</p>
          </>}

          {stage === "complete" && <>
            <span className={styles.kicker}>A LITTLE MOMENT TO COME BACK TO</span>
            <h1 className={styles.title} ref={headingRef} tabIndex={-1}>{gentle ? "Thank you for reading." : "This little world is yours."}</h1>
            <p className={styles.intro}>{gentle ? feelings.gentle.closing : profile.closing}</p>
            <article className={styles.keepsake}>
              <div className={styles.keepsakeRibbon}>ONE OF A KIND. JUST LIKE YOU.</div>
              <GiftScene feeling={gentle ? "gentle" : feeling} photos={gift.media} hugged />
              <div className={styles.keepsakeNames}><span className={styles.kicker}>A LITTLE WORLD FOR</span><h2>{gift.recipient_name}</h2><p>from <strong>{gift.sender_name}</strong>, with care</p></div>
              <GiftContents photos={gift.media.length} notes={notes.length} />
              <span className={styles.keepsakeStamp} aria-hidden="true">{profile.icon}</span>
            </article>
            <button type="button" className={styles.secondary} onClick={replay}>Feel it all again <span aria-hidden="true">↺</span></button>
            {!preview && <Link className={styles.makeOwn} href="/create">Make a little world for someone else ↗</Link>}
          </>}
        </div>
        <footer className={styles.footer}>a little thought, a whole lot of feeling ♡</footer>
      </div>
      <nav className={styles.storyDock} aria-label="Gift navigation">
        {downloadNotice && <p className={styles.notice} role="status">{downloadNotice}</p>}
        <p className={styles.dockHint}>{nextHints[stage]}</p>
        <div className={styles.dockActions}>
          {stageIndex > 0 && <button type="button" className={styles.dockBack} onClick={() => goToStage(stages[stageIndex - 1].id)} aria-label={`Back to ${stages[stageIndex - 1].label.toLowerCase()}`}>←</button>}
          <button type="button" className={styles.primary} disabled={stage === "welcome" && opened} onClick={continueStory}>{nextLabels[stage]}<span aria-hidden="true">{stage === "complete" ? "↓" : "→"}</span></button>
        </div>
      </nav>
      {burst > 0 && !gentle && !reducedMotion && <div className={styles.confetti} key={burst} aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ left: `${(index * 17) % 100}%`, animationDelay: `${(index % 5) * 0.07}s`, color: ["#bc527d", "#e2af52", "#9b7bc6", "#88af9a"][index % 4] }}>{index % 3 === 0 ? "♡" : "✦"}</span>)}</div>}
      {fullPhoto !== null && <PhotoDialog photo={gift.media[fullPhoto]} caption={gift.photo_captions?.[fullPhoto] ?? ""} onClose={() => setFullPhoto(null)} />}
    </section>
  );
}

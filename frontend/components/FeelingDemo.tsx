"use client";

import Link from "next/link";
import { useState } from "react";
import { feelings } from "@/lib/feelings";
import { type GiftFeeling } from "@/lib/api";
import { GiftScene, HeartMark } from "./GiftArtwork";
import { useGiftMotion } from "./useGiftMotion";
import styles from "./GiftExperience.module.css";

const examples: { feeling: GiftFeeling; label: string; title: string; emphasis: string; hint: string; message: string }[] = [
  { feeling: "love", label: "A little love", title: "Big feelings.", emphasis: "Little surprises.", hint: "a little love, just for you", message: "My favourite place isn't a place. It's the ordinary little moments I get to spend with you." },
  { feeling: "longing", label: "Missing you", title: "A thousand miles.", emphasis: "One little hug.", hint: "close at heart, wherever you are", message: "I miss the way we can do absolutely nothing together, and somehow it becomes my favourite part of the day." },
  { feeling: "joy", label: "Happy birthday", title: "Their special day.", emphasis: "A little more magic.", hint: "a pocket-sized happy birthday", message: "Here's to another year of your wonderful, one-of-a-kind self. I'm so glad I get to be part of your story." },
];

export default function FeelingDemo() {
  const [selected, setSelected] = useState(examples[0]);
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const motion = useGiftMotion();
  const profile = feelings[selected.feeling];
  const createUrl = `/create?type=${selected.feeling === "joy" ? "birthday" : "romantic"}&feeling=${selected.feeling}`;
  return (
    <section className={`${styles.world} ${styles.demo}`} data-theme={profile.theme} data-reduced={motion.reducedMotion} aria-label="Try a little feeling">
      <div className={styles.demoEyebrow}><span aria-hidden="true">♥</span> SMALL GIFT. BIG BUTTERFLIES.</div>
      <h1 className={styles.demoTitle} key={`title-${selected.feeling}`}>{selected.title}<em>{selected.emphasis}</em></h1>
      <p className={styles.demoDescription}>Their favourite photos. Your sweetest words.<br />A tiny world that feels like <strong>the two of you.</strong></p>
      <div className={styles.demoTabs} aria-label="Example feelings">{examples.map((example) => <button type="button" key={example.feeling} aria-pressed={selected.feeling === example.feeling} onClick={() => { setSelected(example); setOpen(false); setBurst(0); }}>{feelings[example.feeling].icon} {example.label}</button>)}</div>
      <div className={styles.demoScene}>
        <GiftScene key={selected.feeling} feeling={selected.feeling} hugged={open} celebrate={burst}>
          <span className={styles.sceneLabel}>{selected.hint}</span>
          <button type="button" className={styles.sceneHeart} aria-label="Tap to open this little surprise" aria-expanded={open} onClick={() => { setOpen(true); setBurst(current => current + 1); }}><HeartMark /></button>
          <span className={styles.sceneHint} aria-hidden="true">{open ? "one more tap, one more little happy ♡" : "psst... tap the heart!"}</span>
        </GiftScene>
        <button type="button" className={styles.sceneMotion} onClick={() => motion.setMotionPaused(!motion.motionPaused)} disabled={motion.systemReducedMotion} aria-label={motion.systemReducedMotion ? "Reduced motion from device settings" : motion.motionPaused ? "Resume animations" : "Pause animations"} aria-pressed={motion.reducedMotion}>{motion.reducedMotion ? "▷" : "Ⅱ"}</button>
      </div>
      {open && <div className={styles.demoMessage} key={`note-${selected.feeling}`} role="status">
        <span className={styles.kicker}>IMAGINE THIS, IN YOUR WORDS</span><p>{selected.message}</p>
        <button type="button" className={styles.back} onClick={() => { setOpen(false); setBurst(0); }}>Tuck it away again ↺</button>
      </div>}
      <Link href={createUrl} className={styles.primary}>Make their heart do a little happy <span aria-hidden="true">↗</span></Link>
      <p className={styles.demoFootnote}><span aria-hidden="true">✦</span> Made in minutes. Kept for the feeling.</p>
      <div className={styles.demoGoodies}><span>photos with a story</span><span>a little soundtrack</span><span>secret notes</span></div>
    </section>
  );
}

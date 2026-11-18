"use client";

import Image from "next/image";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { assetUrl, type GiftFeeling } from "@/lib/api";
import styles from "./GiftExperience.module.css";
import art from "./GiftArtwork.module.css";

export function HeartMark() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 55S6 40 6 22C6 7 25 5 32 18C39 5 58 7 58 22C58 40 32 55 32 55Z" fill="currentColor" /><path d="M16 22c0-5 4-8 8-7" stroke="white" strokeOpacity=".65" strokeWidth="4" strokeLinecap="round" /></svg>;
}

export function Envelope({ name, open, onOpen, label }: {
  name: string;
  open: boolean;
  onOpen: () => void;
  label: string;
}) {
  return (
    <button type="button" className={styles.envelopeButton} onClick={onOpen} aria-label={label} aria-expanded={open} disabled={open}>
      <span className={styles.envelope} data-open={open} aria-hidden="true">
        <span className={styles.envelopeBack} />
        <span className={styles.envelopeLetter}><span>one tiny world</span><strong>just for {name}</strong><span>with a whole lot of feeling ♡</span></span>
        <span className={styles.envelopeFlap} />
        <span className={styles.envelopeFront} />
        <span className={styles.envelopeSeal}>♡</span>
        <span className={styles.envelopeStamp}>made<br />for you</span>
      </span>
    </button>
  );
}

export function PocketFriends({ hugged = false, party = false }: { hugged?: boolean; party?: boolean }) {
  const id = useId();
  return (
    <svg className={`${styles.friends} ${art.friends}`} data-hugged={hugged} viewBox="0 0 240 170" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-bear`} cx=".38" cy=".24" r=".8"><stop stopColor="#FFF0D3" /><stop offset=".65" stopColor="#F3C38C" /><stop offset="1" stopColor="#DE9D73" /></radialGradient>
        <radialGradient id={`${id}-bunny`} cx=".35" cy=".25" r=".8"><stop stopColor="#FFFFFF" /><stop offset=".65" stopColor="#FFF3EA" /><stop offset="1" stopColor="#E5C4DE" /></radialGradient>
        <linearGradient id={`${id}-heart`} x1="95" y1="100" x2="143" y2="143" gradientUnits="userSpaceOnUse"><stop stopColor="#FF769C" /><stop offset="1" stopColor="#D52E61" /></linearGradient>
      </defs>
      <ellipse cx="120" cy="153" rx="83" ry="9" fill="currentColor" opacity=".08" />
      <g className={styles.friendLeft}>
        <g className={art.bearBob}>
        <circle cx="64" cy="45" r="17" fill="#E7AE7D" stroke="#A56F58" strokeWidth="2" />
        <circle cx="108" cy="45" r="17" fill="#E7AE7D" stroke="#A56F58" strokeWidth="2" />
        <circle cx="64" cy="45" r="9" fill="#E38E87" />
        <circle cx="108" cy="45" r="9" fill="#E38E87" />
        <path d="M43 88C38 48 119 36 128 86L134 133C135 156 47 158 44 136Z" fill={`url(#${id}-bear)`} stroke="#A56F58" strokeWidth="2.5" />
        <ellipse cx="86" cy="109" rx="26" ry="28" fill="#FFF1DF" />
        <g className={art.blink}><ellipse cx="69" cy="77" rx="3.5" ry="5" fill="#573E48" /><ellipse cx="104" cy="77" rx="3.5" ry="5" fill="#573E48" /><circle cx="70" cy="75" r="1.2" fill="white" /><circle cx="105" cy="75" r="1.2" fill="white" /></g>
        <ellipse cx="87" cy="86" rx="4" ry="3" fill="#72574C" />
        <path d="M80 92q7 7 14 0" stroke="#72574C" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="59" cy="88" rx="9" ry="5.5" fill="#EE949B" />
        <ellipse cx="113" cy="88" rx="9" ry="5.5" fill="#EE949B" />
        <path d="M76 56q7-8 15-2" stroke="#FFF6E6" strokeWidth="5" strokeLinecap="round" />
        {party && <g><path d="m71 48 12-34 24 31Z" fill="#A37FE8" stroke="#7454B0" strokeWidth="2" /><circle cx="83" cy="15" r="5" fill="#FFDB69" /><path d="m78 30 16 5m-19 5 27 4" stroke="#FFE490" strokeWidth="3" /></g>}
        </g>
      </g>
      <g className={styles.friendRight}>
        <g className={art.bunnyBob}>
        <ellipse cx="151" cy="42" rx="11" ry="28" transform="rotate(-12 151 42)" fill="#FFF9EF" stroke="#AA9290" strokeWidth="2" />
        <ellipse cx="184" cy="42" rx="11" ry="28" transform="rotate(12 184 42)" fill="#FFF9EF" stroke="#AA9290" strokeWidth="2" />
        <ellipse cx="151" cy="37" rx="5" ry="17" transform="rotate(-12 151 37)" fill="#F6B6CE" />
        <ellipse cx="184" cy="37" rx="5" ry="17" transform="rotate(12 184 37)" fill="#F6B6CE" />
        <path d="M126 90C125 46 205 44 205 92L211 135C207 158 130 159 124 136Z" fill={`url(#${id}-bunny)`} stroke="#AA829C" strokeWidth="2.5" />
        <ellipse cx="167" cy="116" rx="22" ry="25" fill="#F9E5E8" />
        <g className={`${art.blink} ${art.bunnyEyes}`}><ellipse cx="149" cy="80" rx="3.5" ry="5" fill="#573E48" /><ellipse cx="184" cy="80" rx="3.5" ry="5" fill="#573E48" /><circle cx="150" cy="78" r="1.2" fill="white" /><circle cx="185" cy="78" r="1.2" fill="white" /></g>
        <path d="m165 88 3 3 3-3" stroke="#D781A1" strokeWidth="2" strokeLinecap="round" />
        <path d="M161 92q6 6 12 0" stroke="#72574C" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="140" cy="91" rx="9" ry="5.5" fill="#F4A2BC" />
        <ellipse cx="193" cy="91" rx="9" ry="5.5" fill="#F4A2BC" />
        </g>
      </g>
      <g className={styles.friendHeart}><path d="M121 108C101 87 82 113 121 138C160 113 141 87 121 108Z" fill={`url(#${id}-heart)`} /><path d="M104 111q-3-8 4-8" stroke="#FFCBDD" strokeWidth="3" strokeLinecap="round" /></g>
      <path d="M94 117q-6 9 5 15" stroke="#DAA476" strokeWidth="9" strokeLinecap="round" />
      <path d="M145 117q6 9-5 15" stroke="#E9C6D7" strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}

function PocketFlower() {
  return <svg className={art.flower} viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <ellipse cx="100" cy="183" rx="54" ry="8" fill="#456F64" opacity=".12" />
    <path d="M100 157V79" stroke="#448B70" strokeWidth="7" strokeLinecap="round" />
    <path d="M98 135C58 137 48 105 49 103C79 97 101 117 98 135Zm5-20c37 0 43-30 42-32-28-3-43 16-42 32Z" fill="#75B995" />
    <g className={art.flowerHead}>
      {[0, 60, 120, 180, 240, 300].map(angle => <ellipse key={angle} cx="100" cy="46" rx="17" ry="27" transform={`rotate(${angle} 100 72)`} fill="#FFF5DC" stroke="#E8C8A0" strokeWidth="1.5" />)}
      <circle cx="100" cy="72" r="23" fill="#F4C96A" /><path d="M89 70q3-4 6 0m10 0q3-4 6 0m-17 8q6 5 12 0" stroke="#917042" strokeWidth="2.5" strokeLinecap="round" />
    </g>
    <path d="m69 146 8 32c3 11 43 11 46 0l8-32Z" fill="#D8917C" /><rect x="64" y="139" width="72" height="15" rx="7" fill="#EAA794" /><path d="m90 166 5 5 14-13" stroke="#FFEADD" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

type ParticleStyle = CSSProperties & { "--x": string; "--y": string };

export function HeartBurst({ count = 16 }: { count?: number }) {
  return <div className={art.burst} aria-hidden="true">{Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    const distance = 85 + index % 3 * 25;
    const style: ParticleStyle = { "--x": `${Math.cos(angle) * distance}px`, "--y": `${Math.sin(angle) * distance - 35}px`, animationDelay: `${index % 3 * 35}ms`, color: ["#E83879", "#9261DB", "#F1AD2E", "#FFF7DF"][index % 4] };
    return <span key={index} style={style}>{index % 2 ? "✦" : "♥"}</span>;
  })}</div>;
}

function PhotoStamp({ photo, right = false }: { photo?: string; right?: boolean }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  return <div className={right ? art.postcardRight : art.postcardLeft} data-photo={Boolean(photo)}>
    <span className={art.postcardPicture} data-ready={status === "ready"}>
      <span>{right ? "♥" : "✿"}</span>
      {photo && <Image src={assetUrl(photo)} alt="" fill sizes="90px" unoptimized
        onLoad={event => setStatus(event.currentTarget.naturalWidth ? "ready" : "error")}
        onError={() => setStatus("error")} />}
    </span>
    <small>{status === "error" ? "photo unavailable" : right ? "you + me" : "little joys"}</small>
  </div>;
}

export function GiftScene({ feeling, hugged = false, celebrate = 0, still = false, delivery = false, photos = [], children }: {
  feeling: GiftFeeling; hugged?: boolean; celebrate?: number; still?: boolean; delivery?: boolean; photos?: string[]; children?: ReactNode;
}) {
  const gentle = feeling === "gentle";
  return <div className={art.scene} data-scene={feeling} data-still={still} data-delivery={delivery}>
    <div className={art.scenery} aria-hidden="true">
      <div className={art.halo} /><div className={art.orbit} />
      <span className={art.cloudOne} /><span className={art.cloudTwo} />
      <span className={art.celestial}>{feeling === "longing" ? "☾" : feeling === "joy" ? "✹" : "✦"}</span>
      {Array.from({ length: 7 }, (_, index) => <span key={index} className={art.spark} style={{ left: `${8 + index * 13}%`, top: `${12 + index % 3 * 26}%`, animationDelay: `${-index * .6}s` }}>{gentle ? "·" : index % 2 ? "✧" : "♡"}</span>)}
      {!gentle && <>
        <PhotoStamp key={`left-${photos[0] ?? "illustration"}`} photo={photos[0]} />
        <PhotoStamp key={`right-${photos[1] ?? "illustration"}`} photo={photos[1]} right />
        <svg className={art.paperPlane} viewBox="0 0 60 45"><path d="m3 16 52-12-19 36-9-16Z" fill="#FFFDF5" stroke="#C297BE" strokeWidth="2" /><path d="m27 24 28-20-34 15" fill="#F1DCED" stroke="#C297BE" strokeWidth="2" /></svg>
      </>}
      <div className={art.sceneFriends}>{gentle ? <PocketFlower /> : <PocketFriends hugged={hugged} party={feeling === "joy"} />}</div>
      <span className={art.ground} />
    </div>
    {children}
    {celebrate > 0 && !gentle && <HeartBurst key={celebrate} />}
  </div>;
}

export function AmbientDecor({ icon }: { icon: string }) {
  return (
    <div className={styles.ambient} aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <span key={index} style={{
          left: `${5 + (index * 29) % 90}%`,
          top: `${4 + (index * 17) % 90}%`,
          animationDelay: `${-(index % 6)}s`,
          animationDuration: `${8 + index % 5}s`,
          fontSize: `${16 + index % 4 * 5}px`,
        }}>{index % 3 === 0 ? icon : index % 3 === 1 ? "✧" : "·"}</span>
      ))}
    </div>
  );
}

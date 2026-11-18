"use client";

import { useEffect, useRef, useState } from "react";
import { assetUrl, type GiftFeeling } from "@/lib/api";

const melody = [0, 7, 12, 4, 9, 7, 2, 4, 12, 9, 16, 7, 4, 2, 7, 0];

export function useGiftAudio(url: string | null, musicBox: boolean, feeling: GiftFeeling) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesRef = useRef(new Set<OscillatorNode>());
  const activeRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [notice, setNotice] = useState("");
  const available = Boolean(url || musicBox);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    const context = contextRef.current;
    if (context && gainRef.current) gainRef.current.gain.setTargetAtTime(volume * 0.22, context.currentTime, 0.05);
  }, [volume]);

  useEffect(() => {
    const oscillators = notesRef.current;
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      oscillators.forEach((oscillator) => oscillator.stop());
      oscillators.clear();
      const context = contextRef.current;
      contextRef.current = null;
      gainRef.current = null;
      if (context && context.state !== "closed") {
        void context.close().catch((error: unknown) => console.error("Could not close the music box.", error));
      }
    };
  }, []);

  function pause() {
    activeRef.current = false;
    audioRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    notesRef.current.forEach((oscillator) => oscillator.stop());
    notesRef.current.clear();
    setPlaying(false);
  }

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) pause();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function start() {
    if (!available || activeRef.current) return;
    activeRef.current = true;
    setStarting(true);
    setNotice("");
    try {
      if (url) {
        const audio = audioRef.current;
        if (!audio) throw new Error("The song player isn't ready yet. Please try again.");
        await audio.play();
        if (!activeRef.current) audio.pause();
      } else {
        if (typeof AudioContext === "undefined") {
          throw new Error("This browser doesn't support the music box. You can still enjoy the gift.");
        }
        const context = contextRef.current ?? new AudioContext();
        contextRef.current = context;
        if (!gainRef.current) {
          const master = context.createGain();
          master.gain.value = volume * 0.22;
          master.connect(context.destination);
          gainRef.current = master;
        }
        await context.resume();
        if (!activeRef.current) return;
        const master = gainRef.current;
        const interval = feeling === "joy" ? 0.43 : 0.62;
        const base = feeling === "longing" ? 440 : 523.25;
        let position = 0;
        let nextNote = context.currentTime + 0.03;
        const schedule = () => {
          while (nextNote < context.currentTime + 0.15) {
            const oscillator = context.createOscillator();
            const envelope = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = base * 2 ** (melody[position % melody.length] / 12);
            envelope.gain.setValueAtTime(0, nextNote);
            envelope.gain.linearRampToValueAtTime(0.8, nextNote + 0.015);
            envelope.gain.exponentialRampToValueAtTime(0.001, nextNote + 1.5);
            oscillator.connect(envelope);
            envelope.connect(master);
            notesRef.current.add(oscillator);
            oscillator.onended = () => {
              notesRef.current.delete(oscillator);
              oscillator.disconnect();
              envelope.disconnect();
            };
            oscillator.start(nextNote);
            oscillator.stop(nextNote + 1.6);
            nextNote += interval;
            position += 1;
          }
        };
        schedule();
        timerRef.current = setInterval(schedule, 100);
      }
      if (activeRef.current) setPlaying(true);
    } catch (cause) {
      pause();
      setNotice(cause instanceof Error && cause.name !== "NotAllowedError"
        ? cause.message
        : "Your browser paused the song. Tap Play music to try again.");
    } finally {
      setStarting(false);
    }
  }

  const audio = url ? { src: assetUrl(url), ref: audioRef } : null;

  return {
    audio, available, playing, starting, volume, notice, start, pause, setVolume,
    onPlay: () => { activeRef.current = true; setPlaying(true); },
    onPause: () => { activeRef.current = false; setPlaying(false); },
    onError: () => {
      pause();
      setNotice("Their song couldn't load. The rest of your gift is still here; try Play music again.");
    },
  };
}

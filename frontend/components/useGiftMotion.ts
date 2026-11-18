"use client";

import { useEffect, useState } from "react";

export function useGiftMotion() {
  const [motionPaused, setMotionPaused] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return {
    motionPaused,
    setMotionPaused,
    systemReducedMotion,
    reducedMotion: motionPaused || systemReducedMotion,
  };
}

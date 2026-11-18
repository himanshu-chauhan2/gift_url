"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, type Gift } from "@/lib/api";
import GiftExperience from "@/components/GiftExperience";

export default function GiftPage({ params }: { params: Promise<{ slug: string }> }) {
  const [gift, setGift] = useState<Gift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setGift(null);
    async function loadGift() {
      try {
        const { slug } = await params;
        if (controller.signal.aborted) return;
        const response = await fetch(`${API_URL}/api/gifts/${encodeURIComponent(slug)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "We couldn't find this little moment.");
        if (!controller.signal.aborted) setGift(data as Gift);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This moment couldn't be opened.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadGift();
    return () => controller.abort();
  }, [params]);

  if (loading) return <main className="recipient-page"><div className="recipient-loading" role="status"><span className="loading-heart" aria-hidden="true">♡</span><p>Unwrapping a little moment…</p></div></main>;
  if (error || !gift) return <main className="recipient-page"><div className="recipient-error"><span aria-hidden="true">💌</span><h1>This little moment is hiding.</h1><p role="alert">{error || "We couldn't find this gift. Check that the link is right."}</p><Link href="/" className="button button-primary">Back to Little Moments</Link></div></main>;
  return <main><GiftExperience gift={gift} /></main>;
}

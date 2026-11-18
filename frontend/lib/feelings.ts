import type { GiftFeeling, GiftTheme, GiftType } from "./api";

export const themeOptions: {
  id: GiftTheme;
  name: string;
  detail: string;
  color: string;
  icon: string;
}[] = [
  { id: "petal", name: "Petal picnic", detail: "Rose-tinted love", color: "#ffbcd0", icon: "\u2661" },
  { id: "starlight", name: "Cloud nine", detail: "Dreamy & close", color: "#cfb5f4", icon: "\u263e" },
  { id: "sunshine", name: "Berry sweet", detail: "A pocket of joy", color: "#ffce71", icon: "\u2600" },
  { id: "peach", name: "Peachy keen", detail: "Warm & thankful", color: "#ffb993", icon: "\u273f" },
  { id: "mint", name: "Mint to be", detail: "A gentle pause", color: "#addcc0", icon: "\u2740" },
];

export const feelings: Record<GiftFeeling, {
  label: string;
  icon: string;
  theme: GiftTheme;
  description: string;
  welcome: string;
  closing: string;
}> = {
  love: {
    label: "A little love",
    icon: "\u2661",
    theme: "petal",
    description: "Warm pinks, little hearts, and a note worth keeping.",
    welcome: "Some things feel too big for a text. This little world is one of them.",
    closing: "A few words, a few memories, and a whole lot of you.",
  },
  longing: {
    label: "Missing you",
    icon: "\u263e",
    theme: "starlight",
    description: "Dreamy lilacs, drifting stars, and a little closeness.",
    welcome: "For the days when a screen has to stand in for being there.",
    closing: "A little place to feel close, whenever you need it.",
  },
  joy: {
    label: "Pure happiness",
    icon: "\u2600",
    theme: "sunshine",
    description: "Sunny colours, playful surprises, and a sprinkle of confetti.",
    welcome: "A pocket-sized celebration, with your name on every little bit.",
    closing: "Keep a little of this happiness for an ordinary day.",
  },
  gratitude: {
    label: "Lucky to have you",
    icon: "\u273f",
    theme: "peach",
    description: "Peachy warmth, paper flowers, and the little things that matter.",
    welcome: "A tiny thank-you for the ways you make a difference.",
    closing: "The little things you do can mean more than you know.",
  },
  gentle: {
    label: "Soft & sincere",
    icon: "\u2740",
    theme: "mint",
    description: "Calm greens, softer movement, and space to read at your pace.",
    welcome: "A quiet space for a few honest words. Take your time.",
    closing: "Thank you for reading. There is no rush, and no reply is expected.",
  },
};

export const feelingOptions = Object.entries(feelings).map(([id, profile]) => ({
  id: id as GiftFeeling,
  ...profile,
}));

const defaultFeelings: Record<GiftType, GiftFeeling> = {
  romantic: "love",
  friendship: "gratitude",
  birthday: "joy",
  apology: "gentle",
};

const signals: { feeling: GiftFeeling; pattern: RegExp; weight: number }[] = [
  { feeling: "gentle", pattern: /\b(sorry|apolog(?:y|ize|ise)|forgive|regret|maaf|sincere|griev(?:e|ing)|loss)\b/g, weight: 5 },
  { feeling: "gentle", pattern: /\b(here for you|take your time|not alone|hard time|not (?:okay|ok)|don't love|do not love|no longer love)\b/g, weight: 5 },
  { feeling: "longing", pattern: /\b(miss(?:ing)? you|miss u|long distance|miles apart|far away|wish you were here|until we meet|yaad|door ho)\b/g, weight: 4 },
  { feeling: "joy", pattern: /\b(happy birthday|birthday|celebrat(?:e|ion|ing)|congrat(?:s|ulations)|proud of you|khush|janamdin|janmadin)\b/g, weight: 4 },
  { feeling: "love", pattern: /\b(love|adore|forever|sweetheart|anniversary|soulmate|pyaar|pyar|mohabbat|jaan)\b/g, weight: 3 },
  { feeling: "love", pattern: /\b(my person|life is sweeter|you feel like home|doing life|you and me|tum meri|tum mere)\b/g, weight: 3 },
  { feeling: "gratitude", pattern: /\b(thank(?:s|ful)?|thank you|grateful|gratitude|lucky|shukriya|bestie|friendship|best friend)\b/g, weight: 3 },
  { feeling: "gratitude", pattern: /\b(showing up|being there|count on you|ordinary days brighter)\b/g, weight: 3 },
];

const reasons: Record<GiftFeeling, string> = {
  love: "Your words about love suggest a warm, romantic feeling.",
  longing: "Your words about missing someone suggest a dreamy, close-at-heart feeling.",
  joy: "Your celebratory words suggest a bright, happy feeling.",
  gratitude: "Your words of appreciation suggest a warm, thankful feeling.",
  gentle: "Your words suggest a calmer, more thoughtful experience.",
};

export function matchFeeling(message: string, occasion: GiftType) {
  const fallback = defaultFeelings[occasion];
  if (occasion === "apology") {
    return { id: "gentle" as const, reason: "An apology gets a gentle pace, with no pressure to reply.", source: "occasion" as const };
  }
  const text = message.normalize("NFKC").toLowerCase().replace(/[\u2018\u2019]/g, "'");
  const scores: Record<GiftFeeling, number> = { love: 0, longing: 0, joy: 0, gratitude: 0, gentle: 0 };

  for (const { feeling, pattern, weight } of signals) {
    // Negated affection should not become a romantic recommendation.
    const matches = [...text.matchAll(pattern)].filter((match) => {
      const before = text.slice(Math.max(0, match.index - 40), match.index);
      return !/\b(not|never|don't|do not|no longer|can't|cannot)(?:\s+\w+){0,2}\s+$/.test(before);
    });
    scores[feeling] += Math.min(matches.length, 2) * weight;
  }

  const strongest = feelingOptions.reduce((best, candidate) => (
    scores[candidate.id] > scores[best] ? candidate.id : best
  ), fallback);
  const id = scores.gentle > 0 ? "gentle" : strongest;
  return scores[id] > 0
    ? { id, reason: reasons[id], source: "message" as const }
    : { id: fallback, reason: "Starting with your occasion. Pick another feeling if it fits better.", source: "occasion" as const };
}

export function resolveDesign(
  message: string,
  occasion: GiftType,
  feelingOverride: GiftFeeling | null = null,
  themeOverride: GiftTheme | null = null,
) {
  const match = matchFeeling(message, occasion);
  const feeling = feelingOverride ?? match.id;
  return {
    feeling,
    theme: themeOverride ?? feelings[feeling].theme,
    profile: feelings[feeling],
    reason: feelingOverride ? "This is the feeling you picked. Your words stay exactly as you wrote them." : match.reason,
    automaticFeeling: feelingOverride === null,
    automaticTheme: themeOverride === null,
  };
}

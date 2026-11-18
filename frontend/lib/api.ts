export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export function assetUrl(path: string) {
  return /^(https?:|blob:|data:)/.test(path) ? path : `${API_URL}${path}`;
}

export type GiftType = "birthday" | "apology" | "romantic" | "friendship";

export type GiftTheme = "petal" | "starlight" | "sunshine" | "peach" | "mint";
export type GiftFeeling = "love" | "longing" | "joy" | "gratitude" | "gentle";
export type GiftSoundtrack = "music-box" | "silent";

export type Gift = {
  recipient_name: string;
  sender_name: string;
  message: string;
  type: GiftType;
  theme: GiftTheme;
  media: string[];
  photo_captions: string[];
  music_url: string | null;
  occasion_date: string | null;
  feeling?: GiftFeeling | null;
  secret_notes?: string[];
  soundtrack?: GiftSoundtrack;
};

export const occasions: {
  type: GiftType;
  title: string;
  description: string;
  emoji: string;
  theme: string;
  className: string;
}[] = [
  {
    type: "birthday",
    title: "Birthday",
    description: "Make their day sparkle",
    emoji: "🎂",
    theme: "Birthday wishes",
    className: "occasion-peach",
  },
  {
    type: "romantic",
    title: "Just because",
    description: "A little love, just for them",
    emoji: "💌",
    theme: "A little love note",
    className: "occasion-lilac",
  },
  {
    type: "apology",
    title: "Say I'm sorry",
    description: "Make room for a fresh start",
    emoji: "🌷",
    theme: "From my heart",
    className: "occasion-mint",
  },
  {
    type: "friendship",
    title: "Friendship",
    description: "A scrapbook of your little moments",
    emoji: "🫶",
    theme: "A little friendship gift",
    className: "occasion-cream",
  },
];

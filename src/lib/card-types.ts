export const CARD_TYPES = ["topic", "note", "code", "project", "company"] as const;
export type CardType = (typeof CARD_TYPES)[number];
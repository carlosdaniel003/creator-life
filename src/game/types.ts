export type ThemeId = "games" | "technology" | "vlog" | "tutorial" | "challenge";
export type FormatId = "short" | "standard" | "review" | "documentary";
export type ThumbnailId = "expressive" | "clean" | "big-text" | "scene";
export type EditingBlockId = "hook" | "context" | "development" | "highlight" | "cta";

export interface PlayerState {
  day: number;
  hour: number;
  energy: number;
  hunger: number;
  creativity: number;
  money: number;
  subscribers: number;
  totalViews: number;
  videos: number;
}

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  trend: number;
  color: number;
}

export interface FormatOption {
  id: FormatId;
  label: string;
  description: string;
  reachMultiplier: number;
  qualityBonus: number;
  energyCost: number;
  creativityCost: number;
  hours: number;
  idealThemes: ThemeId[];
  idealOrder: EditingBlockId[];
}

export interface ThumbnailOption {
  id: ThumbnailId;
  label: string;
  description: string;
  clickBonus: number;
  credibilityBonus: number;
  color: number;
}

export interface EditingBlockOption {
  id: EditingBlockId;
  label: string;
  shortLabel: string;
  description: string;
  color: number;
}

export interface VideoDraft {
  themeId: ThemeId | null;
  formatId: FormatId | null;
  title: string;
  thumbnailId: ThumbnailId | null;
  editingOrder: EditingBlockId[];
}

export interface VideoResult {
  quality: number;
  planningScore: number;
  editingScore: number;
  titleScore: number;
  views: number;
  subscribers: number;
  revenue: number;
  performanceLabel: string;
}

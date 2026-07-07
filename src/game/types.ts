export type ThemeId = "games" | "technology" | "vlog" | "tutorial" | "challenge";
export type FormatId = "short" | "standard" | "review" | "documentary";
export type ThumbnailId = "expressive" | "clean" | "big-text" | "scene";
export type EditingBlockId = "hook" | "context" | "development" | "highlight" | "cta";
export type BillId = "rent" | "internet" | "electricity" | "college";
export type BillStatus = "scheduled" | "pending" | "paid";
export type TransactionType = "income" | "expense";
export type WeatherType = "clear" | "cloudy" | "rain" | "storm";
export type BookId =
  | "editing-rhythm"
  | "camera-confidence"
  | "click-design"
  | "retention-script"
  | "creator-technology"
  | "patient-audience";
export type EquipmentSlot =
  | "cpu"
  | "gpu"
  | "ram"
  | "storage"
  | "monitor"
  | "microphone"
  | "camera"
  | "internet";
export type RoomUpgradeSlot =
  | "bed"
  | "chair"
  | "desk"
  | "lighting"
  | "acoustic"
  | "decor";
export type SkillId =
  | "editing"
  | "communication"
  | "design"
  | "scripting"
  | "technology"
  | "marketing";
export type ReputationId = "audience" | "professional" | "academic";
export type ProductionStageId = "planning" | "recording" | "editing" | "upload";

export interface PlayerState {
  day: number;
  hour: number;
  age?: number;
  energy: number;
  hunger: number;
  thirst?: number;
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
  /** Ordem correta sorteada para esta produção. Não é exibida ao jogador. */
  editingIdealOrder?: EditingBlockId[];
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

export interface PublishedVideo {
  id: string;
  title: string;
  themeId: ThemeId;
  formatId: FormatId;
  thumbnailId: ThumbnailId;
  editingOrder: EditingBlockId[];
  publishedDay: number;
  publishedHour: number;
  ageHours: number;
  subscribersAtPublish: number;
  hiddenQuality: number;
  hiddenPlanningScore: number;
  hiddenEditingScore: number;
  hiddenTitleScore: number;
  initialMomentum: number;
  evergreenFactor: number;
  trendFactor: number;
  viralFactor: number;
  cadenceFactor?: number;
  totalViews: number;
  totalLikes: number;
  totalSubscribers: number;
  totalRevenue: number;
  viewRemainder: number;
  likeRemainder: number;
  subscriberRemainder: number;
  revenueRemainder: number;
}

export interface ChannelGain {
  views: number;
  likes: number;
  subscribers: number;
  revenue: number;
  sourceVideoId: string | null;
  sourceTitle: string;
}

export interface ChannelSimulationSave {
  videos: PublishedVideo[];
  channelHours: number;
  lastSavedAt: number;
}

export interface BillEntry {
  uid: string;
  id: BillId;
  label: string;
  baseAmount: number;
  dueDay: number;
  dueMonth: number;
  dueAbsoluteDay: number;
  status: BillStatus;
  paidAbsoluteDay: number | null;
}

export interface FinanceTransaction {
  id: string;
  day: number;
  hour: number;
  type: TransactionType;
  label: string;
  amount: number;
}

export interface LifeSimulationSave {
  bills: BillEntry[];
  transactions: FinanceTransaction[];
  collegeGrade: number;
  studyHoursThisWeek: number;
  evaluatedWeek: number;
  freelanceJobs: number;
  totalExpenses: number;
  totalFreelanceIncome: number;
  lastProcessedDay: number;
}

export interface ProgressionModifiers {
  qualityCeiling: number;
  qualityConsistency: number;
  planningBonus: number;
  editingBonus: number;
  titleBonus: number;
  audioVisualBonus: number;
  stageTimeMultipliers: Record<ProductionStageId, number>;
  energyCostMultiplier: number;
  freelanceIncomeMultiplier: number;
  bedRecoveryMultiplier: number;
  creativityRecoveryMultiplier: number;
  monthlyPowerCost: number;
  monthlyInternetSurcharge: number;
}

export interface CourseProgress {
  courseId: string;
  enrolled: boolean;
  completed: boolean;
  hoursCompleted: number;
}

export interface SponsorOffer {
  id: string;
  brand: string;
  requiredTheme: ThemeId | null;
  payment: number;
  minQuality: number;
  expiresDay: number;
  accepted: boolean;
  completed: boolean;
}

export interface ProgressionSave {
  equipment: Record<EquipmentSlot, number>;
  room: Record<RoomUpgradeSlot, number>;
  equipmentCondition: Record<EquipmentSlot, number>;
  courses: CourseProgress[];
  skills: Record<SkillId, number>;
  skillXp: Record<SkillId, number>;
  reputations: Record<ReputationId, number>;
  lastMaintenanceDay: number;
  lastProcessedDay: number;
  lastSubscriptionMonth: number;
  totalInvested: number;
  videosPracticed: number;
  freelanceCompleted: number;
  sponsorOffers: SponsorOffer[];
  activeSponsorId: string | null;
  claimedGoals: string[];
}

export interface BookProgress {
  bookId: BookId;
  hoursRead: number;
  completed: boolean;
}

export interface ReadingSave {
  books: BookProgress[];
  completedBooks: BookId[];
  totalReadingHours: number;
}

export interface CreatorLifeSave {
  version: 5;
  state: PlayerState;
  channel: ChannelSimulationSave;
  life: LifeSimulationSave;
  progression: ProgressionSave;
  reading: ReadingSave;
}

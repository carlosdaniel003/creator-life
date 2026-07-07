import { EDITING_BLOCKS, FORMATS, THEMES, THUMBNAILS } from "../game/videoData";
import type {
  EditingBlockId,
  FormatId,
  FormatOption,
  PlayerState,
  ProductionStageId,
  ProgressionModifiers,
  VideoDraft,
  VideoResult
} from "../game/types";

export interface ProductionStage {
  id: ProductionStageId;
  label: string;
  description: string;
  hours: number;
  durationMs: number;
}

export interface ConnectorStyle {
  shape: "circle" | "diamond" | "triangle" | "hexagon";
  color: string;
}

const CONNECTORS: ConnectorStyle[] = [
  { shape: "circle", color: "#38bdf8" },
  { shape: "diamond", color: "#f59e0b" },
  { shape: "triangle", color: "#a78bfa" },
  { shape: "hexagon", color: "#42e8b4" }
];

const EDITING_CHALLENGES: Record<FormatId, EditingBlockId[][]> = {
  short: [
    ["hook", "highlight", "development", "cta", "context"],
    ["highlight", "hook", "context", "development", "cta"],
    ["hook", "context", "cta", "highlight", "development"],
    ["hook", "development", "highlight", "context", "cta"]
  ],
  standard: [
    ["hook", "context", "development", "highlight", "cta"],
    ["highlight", "hook", "context", "development", "cta"],
    ["hook", "context", "cta", "development", "highlight"],
    ["hook", "development", "context", "highlight", "cta"]
  ],
  review: [
    ["hook", "context", "development", "highlight", "cta"],
    ["highlight", "hook", "context", "development", "cta"],
    ["hook", "context", "development", "cta", "highlight"],
    ["context", "hook", "development", "highlight", "cta"]
  ],
  documentary: [
    ["hook", "context", "development", "highlight", "cta"],
    ["highlight", "hook", "context", "development", "cta"],
    ["hook", "context", "highlight", "development", "cta"],
    ["hook", "context", "cta", "development", "highlight"]
  ]
};

const DEFAULT_MODIFIERS: ProgressionModifiers = {
  qualityCeiling: 62,
  qualityConsistency: 0.4,
  planningBonus: 0,
  editingBonus: 0,
  titleBonus: 0,
  audioVisualBonus: 0,
  stageTimeMultipliers: {
    planning: 1,
    recording: 1,
    editing: 1,
    upload: 1
  },
  energyCostMultiplier: 1,
  freelanceIncomeMultiplier: 1,
  bedRecoveryMultiplier: 1,
  creativityRecoveryMultiplier: 1,
  monthlyPowerCost: 0,
  monthlyInternetSurcharge: 0
};

export function createVideoDraft(): VideoDraft {
  const editingIdealOrder = createEditingChallenge("standard");
  return {
    themeId: null,
    formatId: null,
    title: "",
    thumbnailId: null,
    editingIdealOrder,
    editingOrder: createShuffledEditingOrder(editingIdealOrder)
  };
}

export function createEditingChallenge(formatId: FormatId): EditingBlockId[] {
  const variants = EDITING_CHALLENGES[formatId];
  const selected = variants[Math.floor(Math.random() * variants.length)];
  return [...selected];
}

export function createShuffledEditingOrder(
  idealOrder: EditingBlockId[]
): EditingBlockId[] {
  const shuffled = shuffle(EDITING_BLOCKS.map((block) => block.id));
  if (shuffled.every((blockId, index) => blockId === idealOrder[index])) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

export function getEditingIdealOrder(
  draft: VideoDraft,
  format: FormatOption
): EditingBlockId[] {
  const order = draft.editingIdealOrder;
  if (
    order &&
    order.length === EDITING_BLOCKS.length &&
    EDITING_BLOCKS.every((block) => order.includes(block.id))
  ) {
    return order;
  }
  return format.idealOrder;
}

export function validateVideoDraft(
  draft: VideoDraft,
  state: PlayerState,
  modifiers: ProgressionModifiers = DEFAULT_MODIFIERS
): string | null {
  if (!draft.themeId) return "Escolha o tema do vídeo.";
  if (!draft.formatId) return "Escolha o formato do vídeo.";
  if (draft.title.trim().length < 8) {
    return "O título precisa ter pelo menos 8 caracteres.";
  }
  if (!draft.thumbnailId) return "Escolha um estilo de thumbnail.";

  const format = FORMATS.find((item) => item.id === draft.formatId);
  if (!format) return "Formato inválido.";
  const energyCost = Math.ceil(
    format.energyCost * modifiers.energyCostMultiplier
  );
  if (state.energy < energyCost) {
    return `Este formato exige ${energyCost} de energia com sua estrutura atual.`;
  }
  if (state.creativity < format.creativityCost) {
    return `Este formato exige ${format.creativityCost} de criatividade.`;
  }

  return null;
}

export function getProductionStages(
  format: FormatOption,
  modifiers: ProgressionModifiers = DEFAULT_MODIFIERS
): ProductionStage[] {
  const timing: Record<FormatOption["id"], number[]> = {
    short: [1, 1, 1, 1],
    standard: [1, 2, 1, 1],
    review: [1, 3, 2, 1],
    documentary: [2, 4, 3, 2]
  };
  const [planningHours, recordingHours, editingHours, uploadHours] =
    timing[format.id];
  const visualMultiplier =
    format.id === "documentary"
      ? 1.35
      : format.id === "review"
        ? 1.18
        : format.id === "short"
          ? 0.78
          : 1;

  return [
    createStage(
      "planning",
      "Planejamento e roteiro",
      "Organizando a ideia, os pontos principais e a sequência de gravação.",
      planningHours,
      1350,
      visualMultiplier,
      modifiers
    ),
    createStage(
      "recording",
      "Gravação",
      "Capturando cenas, refazendo trechos e registrando a apresentação.",
      recordingHours,
      2300,
      visualMultiplier,
      modifiers
    ),
    createStage(
      "editing",
      "Renderização",
      "Processando a montagem, o áudio, a imagem e exportando o arquivo final.",
      editingHours,
      1750,
      visualMultiplier,
      modifiers
    ),
    createStage(
      "upload",
      "Upload e processamento",
      "Enviando o arquivo. O vídeo só ficará público quando a plataforma concluir o processamento.",
      uploadHours,
      2800,
      visualMultiplier,
      modifiers
    )
  ];
}

export function getTotalProductionHours(
  format: FormatOption,
  modifiers: ProgressionModifiers = DEFAULT_MODIFIERS
): number {
  return getProductionStages(format, modifiers).reduce(
    (sum, stage) => sum + stage.hours,
    0
  );
}

export function getConnector(
  draft: VideoDraft,
  format: FormatOption,
  blockId: EditingBlockId,
  side: "left" | "right"
): ConnectorStyle | null {
  const idealOrder = getEditingIdealOrder(draft, format);
  const idealIndex = idealOrder.indexOf(blockId);

  if (side === "left") {
    return idealIndex > 0 ? CONNECTORS[idealIndex - 1] : null;
  }

  return idealIndex < idealOrder.length - 1
    ? CONNECTORS[idealIndex]
    : null;
}

export function isConnectorMatched(
  draft: VideoDraft,
  format: FormatOption,
  currentIndex: number,
  side: "left" | "right"
): boolean {
  const idealOrder = getEditingIdealOrder(draft, format);
  const current = draft.editingOrder[currentIndex];
  const currentIdealIndex = idealOrder.indexOf(current);

  if (side === "left") {
    const previous = draft.editingOrder[currentIndex - 1];
    return (
      previous !== undefined &&
      idealOrder.indexOf(previous) === currentIdealIndex - 1
    );
  }

  const next = draft.editingOrder[currentIndex + 1];
  return (
    next !== undefined &&
    idealOrder.indexOf(next) === currentIdealIndex + 1
  );
}

export function getMatchedConnectorCount(
  draft: VideoDraft,
  format: FormatOption
): number {
  let matched = 0;
  for (let index = 0; index < draft.editingOrder.length - 1; index += 1) {
    if (isConnectorMatched(draft, format, index, "right")) matched += 1;
  }
  return matched;
}

export function calculateHiddenVideoResult(
  draft: VideoDraft,
  state: PlayerState,
  modifiers: ProgressionModifiers = DEFAULT_MODIFIERS
): VideoResult {
  const theme = THEMES.find((item) => item.id === draft.themeId);
  const format = FORMATS.find((item) => item.id === draft.formatId);
  const thumbnail = THUMBNAILS.find((item) => item.id === draft.thumbnailId);

  if (!theme || !format || !thumbnail) {
    throw new Error("Rascunho de vídeo incompleto.");
  }

  const titleScore = clamp(
    calculateTitleScore(draft.title) + modifiers.titleBonus,
    0,
    100
  );
  const compatibilityBonus = format.idealThemes.includes(theme.id) ? 12 : 2;
  const planningScore = clamp(
    35 +
      theme.trend +
      compatibilityBonus +
      titleScore * 0.25 +
      thumbnail.clickBonus +
      thumbnail.credibilityBonus +
      modifiers.planningBonus,
    0,
    100
  );
  const editingScore = clamp(
    calculateEditingScore(draft, format) + modifiers.editingBonus,
    0,
    100
  );
  const uncertaintyRange = 16 - modifiers.qualityConsistency * 10;
  const uncertainty =
    -uncertaintyRange + Math.random() * uncertaintyRange * 2;
  const executionFactor = 0.72 + modifiers.qualityConsistency * 0.28;
  const rawQuality =
    (planningScore * 0.36 +
      editingScore * 0.39 +
      state.creativity * 0.1 +
      format.qualityBonus +
      modifiers.audioVisualBonus) *
      executionFactor +
    uncertainty;
  const quality = Math.round(
    clamp(rawQuality, 0, modifiers.qualityCeiling)
  );

  return {
    quality,
    planningScore: Math.round(planningScore),
    editingScore: Math.round(editingScore),
    titleScore: Math.round(titleScore),
    views: 0,
    subscribers: 0,
    revenue: 0,
    performanceLabel: "Desempenho ainda desconhecido"
  };
}

function createStage(
  id: ProductionStageId,
  label: string,
  description: string,
  baseHours: number,
  baseDurationMs: number,
  visualMultiplier: number,
  modifiers: ProgressionModifiers
): ProductionStage {
  const timeMultiplier = modifiers.stageTimeMultipliers[id];
  const hours = Math.max(
    0.5,
    Math.round(baseHours * timeMultiplier * 2) / 2
  );

  return {
    id,
    label,
    description,
    hours,
    durationMs: Math.max(
      750,
      Math.round(baseDurationMs * visualMultiplier * Math.max(0.55, timeMultiplier))
    )
  };
}

function calculateEditingScore(
  draft: VideoDraft,
  format: FormatOption
): number {
  const idealOrder = getEditingIdealOrder(draft, format);
  let score = 20;

  draft.editingOrder.forEach((blockId, index) => {
    if (blockId === idealOrder[index]) score += 12;
  });

  for (let index = 0; index < draft.editingOrder.length - 1; index += 1) {
    const current = draft.editingOrder[index];
    const next = draft.editingOrder[index + 1];
    const idealIndex = idealOrder.indexOf(current);
    if (idealOrder[idealIndex + 1] === next) score += 5;
  }

  return clamp(score, 0, 100);
}

function calculateTitleScore(title: string): number {
  const normalized = title.trim();
  let score = 35;

  if (normalized.length >= 22 && normalized.length <= 52) score += 25;
  else if (normalized.length >= 12) score += 12;
  if (normalized.includes("?")) score += 8;
  if (/\d/.test(normalized)) score += 7;

  const lower = normalized.toLocaleLowerCase("pt-BR");
  const words = ["como", "testei", "melhor", "pior", "guia", "segredo", "mudou", "zero"];
  score += words.filter((word) => lower.includes(word)).length * 5;

  if (normalized === normalized.toUpperCase() && normalized.length > 12) {
    score -= 12;
  }

  return clamp(score, 0, 100);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

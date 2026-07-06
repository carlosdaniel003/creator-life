import { EDITING_BLOCKS, FORMATS, THEMES, THUMBNAILS } from "../game/videoData";
import type {
  EditingBlockId,
  FormatOption,
  PlayerState,
  VideoDraft,
  VideoResult
} from "../game/types";

export interface ProductionStage {
  id: "planning" | "recording" | "editing" | "upload";
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

export function createVideoDraft(): VideoDraft {
  return {
    themeId: null,
    formatId: null,
    title: "",
    thumbnailId: null,
    editingOrder: shuffle(EDITING_BLOCKS.map((block) => block.id))
  };
}

export function validateVideoDraft(
  draft: VideoDraft,
  state: PlayerState
): string | null {
  if (!draft.themeId) return "Escolha o tema do vídeo.";
  if (!draft.formatId) return "Escolha o formato do vídeo.";
  if (draft.title.trim().length < 8) {
    return "O título precisa ter pelo menos 8 caracteres.";
  }
  if (!draft.thumbnailId) return "Escolha um estilo de thumbnail.";

  const format = FORMATS.find((item) => item.id === draft.formatId);
  if (!format) return "Formato inválido.";
  if (state.energy < format.energyCost) {
    return `Este formato exige ${format.energyCost} de energia.`;
  }
  if (state.creativity < format.creativityCost) {
    return `Este formato exige ${format.creativityCost} de criatividade.`;
  }

  return null;
}

export function getProductionStages(format: FormatOption): ProductionStage[] {
  const timing: Record<FormatOption["id"], number[]> = {
    short: [1, 1, 1, 1],
    standard: [1, 2, 1, 1],
    review: [1, 3, 2, 1],
    documentary: [2, 4, 3, 2]
  };
  const [planningHours, recordingHours, editingHours, uploadHours] =
    timing[format.id];
  const multiplier =
    format.id === "documentary"
      ? 1.35
      : format.id === "review"
        ? 1.18
        : format.id === "short"
          ? 0.78
          : 1;

  return [
    {
      id: "planning",
      label: "Planejamento e roteiro",
      description: "Organizando a ideia, os pontos principais e a sequência de gravação.",
      hours: planningHours,
      durationMs: Math.round(1350 * multiplier)
    },
    {
      id: "recording",
      label: "Gravação",
      description: "Capturando cenas, refazendo trechos e registrando a apresentação.",
      hours: recordingHours,
      durationMs: Math.round(2300 * multiplier)
    },
    {
      id: "editing",
      label: "Renderização",
      description: "Processando a montagem, o áudio, a imagem e exportando o arquivo final.",
      hours: editingHours,
      durationMs: Math.round(1750 * multiplier)
    },
    {
      id: "upload",
      label: "Upload e processamento",
      description: "Enviando o arquivo. O vídeo só ficará público quando a plataforma concluir o processamento.",
      hours: uploadHours,
      durationMs: Math.round(2800 * multiplier)
    }
  ];
}

export function getTotalProductionHours(format: FormatOption): number {
  return getProductionStages(format).reduce(
    (sum, stage) => sum + stage.hours,
    0
  );
}

export function getConnector(
  format: FormatOption,
  blockId: EditingBlockId,
  side: "left" | "right"
): ConnectorStyle | null {
  const idealIndex = format.idealOrder.indexOf(blockId);

  if (side === "left") {
    return idealIndex > 0 ? CONNECTORS[idealIndex - 1] : null;
  }

  return idealIndex < format.idealOrder.length - 1
    ? CONNECTORS[idealIndex]
    : null;
}

export function isConnectorMatched(
  draft: VideoDraft,
  format: FormatOption,
  currentIndex: number,
  side: "left" | "right"
): boolean {
  const current = draft.editingOrder[currentIndex];
  const currentIdealIndex = format.idealOrder.indexOf(current);

  if (side === "left") {
    const previous = draft.editingOrder[currentIndex - 1];
    return (
      previous !== undefined &&
      format.idealOrder.indexOf(previous) === currentIdealIndex - 1
    );
  }

  const next = draft.editingOrder[currentIndex + 1];
  return (
    next !== undefined &&
    format.idealOrder.indexOf(next) === currentIdealIndex + 1
  );
}

export function calculateHiddenVideoResult(
  draft: VideoDraft,
  state: PlayerState
): VideoResult {
  const theme = THEMES.find((item) => item.id === draft.themeId);
  const format = FORMATS.find((item) => item.id === draft.formatId);
  const thumbnail = THUMBNAILS.find((item) => item.id === draft.thumbnailId);

  if (!theme || !format || !thumbnail) {
    throw new Error("Rascunho de vídeo incompleto.");
  }

  const titleScore = calculateTitleScore(draft.title);
  const compatibilityBonus = format.idealThemes.includes(theme.id) ? 12 : 2;
  const planningScore = clamp(
    35 +
      theme.trend +
      compatibilityBonus +
      titleScore * 0.25 +
      thumbnail.clickBonus +
      thumbnail.credibilityBonus,
    0,
    100
  );
  const editingScore = calculateEditingScore(draft, format);
  const uncertainty = -8 + Math.random() * 16;
  const quality = Math.round(
    clamp(
      planningScore * 0.4 +
        editingScore * 0.4 +
        state.creativity * 0.12 +
        format.qualityBonus +
        uncertainty,
      0,
      100
    )
  );

  return {
    quality,
    planningScore: Math.round(planningScore),
    editingScore,
    titleScore,
    views: 0,
    subscribers: 0,
    revenue: 0,
    performanceLabel: "Desempenho ainda desconhecido"
  };
}

function calculateEditingScore(
  draft: VideoDraft,
  format: FormatOption
): number {
  let score = 20;

  draft.editingOrder.forEach((blockId, index) => {
    if (blockId === format.idealOrder[index]) score += 12;
  });

  for (let index = 0; index < draft.editingOrder.length - 1; index += 1) {
    const current = draft.editingOrder[index];
    const next = draft.editingOrder[index + 1];
    const idealIndex = format.idealOrder.indexOf(current);
    if (format.idealOrder[idealIndex + 1] === next) score += 5;
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

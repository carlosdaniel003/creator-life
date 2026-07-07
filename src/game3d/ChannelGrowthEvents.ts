import type { ChannelGain, PublishedVideo, ThemeId } from "../game/types";
import "../channel-growth-events.css";
import { BalancedChannelSimulation } from "./BalancedChannelSimulation";
import { CreatorLife3D } from "./CreatorLife3D";
import { ProgressionSystem } from "./ProgressionSystem";

interface GrowthContext {
  skillAverage: number;
  equipmentAverage: number;
  reputationAverage: number;
  qualityCeiling: number;
  completedCourses: number;
}

interface GrowthEventRecord {
  id: string;
  type: GrowthEventType;
  title: string;
  description: string;
  videoId: string;
  videoTitle: string;
  channelHour: number;
  day: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  subscribers: number;
  watchHours: number;
  revenue: number;
  impact: "small" | "medium" | "large";
}

type GrowthEventType =
  | "comment-wave"
  | "community-share"
  | "external-citation"
  | "creator-mention"
  | "recommendation-burst"
  | "catalog-rediscovery"
  | "community-discussion";

interface AudienceFeedback {
  stage: "24h" | "72h";
  score: number;
  sentiment: "very-positive" | "positive" | "mixed" | "negative";
  headline: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  generatedAtAgeHours: number;
}

interface GrowthVideo extends PublishedVideo {
  totalComments?: number;
  audienceFeedback?: AudienceFeedback;
}

interface GrowthSimulation {
  videos: GrowthVideo[];
  host: {
    getState: () => {
      day: number;
      subscribers: number;
      totalViews: number;
      money: number;
    };
    onGain: (gain: ChannelGain) => void;
    onChange: () => void;
  };
  channelHours: number;
  nicheAuthority: Record<ThemeId, number>;
  growthEvents?: GrowthEventRecord[];
  nextGrowthEventCheckHour?: number;
  growthEventCooldownUntil?: number;
  growthMissedChecks?: number;
}

declare global {
  interface Window {
    __creatorLifeGrowthContext?: () => GrowthContext;
  }
}

const EVENT_CHECK_INTERVAL_HOURS = 4;
const EVENT_COOLDOWN_HOURS = 7;
const MAX_EVENT_HISTORY = 40;
const PATCH_KEY = "__creatorLifeChannelGrowthPatched";

const channelPrototype = BalancedChannelSimulation.prototype as any;

if (!channelPrototype[PATCH_KEY]) {
  channelPrototype[PATCH_KEY] = true;

  const originalAddVideo = channelPrototype.addVideo;
  const originalAdvance = channelPrototype.advance;
  const originalSerialize = channelPrototype.serialize;
  const originalRestore = channelPrototype.restore;
  const originalRenderLibraryHtml = channelPrototype.renderLibraryHtml;

  channelPrototype.addVideo = function (...args: unknown[]) {
    const video = originalAddVideo.apply(this, args) as GrowthVideo;
    normalizeGrowthVideo(video);
    return video;
  };

  channelPrototype.advance = function (
    hours: number,
    silent = false
  ): ChannelGain {
    const simulation = this as GrowthSimulation;
    const previousChannelHour = Number(simulation.channelHours ?? 0);
    const aggregate = originalAdvance.call(this, hours, silent) as ChannelGain;

    generateMatureFeedback(simulation);
    const eventGain = processGrowthEventChecks(
      simulation,
      previousChannelHour,
      Number(simulation.channelHours ?? previousChannelHour),
      silent
    );

    if (eventGain) mergeGain(aggregate, eventGain);
    return aggregate;
  };

  channelPrototype.serialize = function () {
    const simulation = this as GrowthSimulation;
    const serialized = originalSerialize.call(this) as Record<string, unknown>;
    return {
      ...serialized,
      growthEvents: [...(simulation.growthEvents ?? [])],
      nextGrowthEventCheckHour: simulation.nextGrowthEventCheckHour,
      growthEventCooldownUntil: simulation.growthEventCooldownUntil,
      growthMissedChecks: simulation.growthMissedChecks
    };
  };

  channelPrototype.restore = function (saved: any) {
    const simulation = this as GrowthSimulation;
    simulation.growthEvents = Array.isArray(saved?.growthEvents)
      ? saved.growthEvents.slice(0, MAX_EVENT_HISTORY)
      : [];
    simulation.nextGrowthEventCheckHour = Number.isFinite(
      saved?.nextGrowthEventCheckHour
    )
      ? Number(saved.nextGrowthEventCheckHour)
      : Number(saved?.channelHours ?? 0) + EVENT_CHECK_INTERVAL_HOURS;
    simulation.growthEventCooldownUntil = Number.isFinite(
      saved?.growthEventCooldownUntil
    )
      ? Number(saved.growthEventCooldownUntil)
      : 0;
    simulation.growthMissedChecks = Number.isFinite(saved?.growthMissedChecks)
      ? Number(saved.growthMissedChecks)
      : 0;

    const result = originalRestore.call(this, saved) as ChannelGain;
    simulation.videos.forEach(normalizeGrowthVideo);
    generateMatureFeedback(simulation);
    return result;
  };

  channelPrototype.renderLibraryHtml = function (): string {
    const simulation = this as GrowthSimulation;
    const base = originalRenderLibraryHtml.call(this) as string;
    return `${base}${renderGrowthInsights(simulation)}`;
  };
}

patchProgressionContext();
patchComputerLabels();
installEventNotifications();

function patchProgressionContext(): void {
  const prototype = ProgressionSystem.prototype as any;
  if (prototype.__creatorLifeGrowthContextPatched) return;
  prototype.__creatorLifeGrowthContextPatched = true;

  const originalRestore = prototype.restore;
  prototype.restore = function (...args: unknown[]): void {
    originalRestore.apply(this, args);
    const instance = this as any;
    window.__creatorLifeGrowthContext = () => {
      const skills = Object.values(instance.save?.skills ?? {}).map(Number);
      const equipment = Object.values(instance.save?.equipment ?? {}).map(Number);
      const reputations = Object.values(instance.save?.reputations ?? {}).map(Number);
      const completedCourses = Array.isArray(instance.save?.courses)
        ? instance.save.courses.filter((course: { completed?: boolean }) =>
            Boolean(course.completed)
          ).length
        : 0;
      const modifiers = instance.getModifiers?.() ?? {};

      return {
        skillAverage: average(skills),
        equipmentAverage: average(equipment),
        reputationAverage: average(reputations),
        qualityCeiling: Number(modifiers.qualityCeiling ?? 62),
        completedCourses
      };
    };
  };
}

function patchComputerLabels(): void {
  const prototype = CreatorLife3D.prototype as any;
  if (prototype.__creatorLifeChannelLabelsPatched) return;
  prototype.__creatorLifeChannelLabelsPatched = true;

  const originalShowModal = prototype.showModal;
  prototype.showModal = function (
    title: string,
    body: string,
    actions: Array<{ label: string; action: () => void; secondary?: boolean }>
  ): void {
    const nextTitle =
      title === "Biblioteca do canal" ? "Nosso canal e insights" : title;
    const nextActions = actions.map((action) => ({
      ...action,
      label:
        action.label === "Ver vídeos publicados"
          ? "Ver nosso canal e insights"
          : action.label
    }));
    originalShowModal.call(this, nextTitle, body, nextActions);
  };
}

function normalizeGrowthVideo(video: GrowthVideo): void {
  video.totalComments = Number(video.totalComments ?? 0);
  if (video.audienceFeedback) {
    video.audienceFeedback = {
      ...video.audienceFeedback,
      strengths: [...(video.audienceFeedback.strengths ?? [])],
      improvements: [...(video.audienceFeedback.improvements ?? [])]
    };
  }
}

function generateMatureFeedback(simulation: GrowthSimulation): void {
  for (const video of simulation.videos) {
    normalizeGrowthVideo(video);
    const currentStage = video.audienceFeedback?.stage;

    if (video.ageHours >= 72 && currentStage !== "72h") {
      video.audienceFeedback = createAudienceFeedback(video, "72h");
      emitFeedbackReady(video);
      simulation.host.onChange();
    } else if (video.ageHours >= 24 && !currentStage) {
      video.audienceFeedback = createAudienceFeedback(video, "24h");
      emitFeedbackReady(video);
      simulation.host.onChange();
    }
  }
}

function createAudienceFeedback(
  video: GrowthVideo,
  stage: "24h" | "72h"
): AudienceFeedback {
  const impressions = Math.max(1, Number(video.totalImpressions ?? 0));
  const views = Math.max(1, video.totalViews);
  const ctr = Number(video.ctr ?? video.totalClicks! / impressions);
  const retention = Number(video.retentionRate ?? 0.35);
  const likeRate = video.totalLikes / views;
  const commentRate = Number(video.totalComments ?? 0) / views;
  const subscriberRate = video.totalSubscribers / views;

  const ctrScore = clamp((ctr / 0.075) * 100, 0, 100);
  const retentionScore = clamp((retention / 0.55) * 100, 0, 100);
  const engagementScore = clamp(
    (likeRate / 0.055) * 72 + (commentRate / 0.012) * 28,
    0,
    100
  );
  const conversionScore = clamp((subscriberRate / 0.014) * 100, 0, 100);
  const score = Math.round(
    video.hiddenQuality * 0.32 +
      ctrScore * 0.2 +
      retentionScore * 0.27 +
      engagementScore * 0.11 +
      conversionScore * 0.1
  );

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (ctr >= 0.06) strengths.push("Título e thumbnail estão atraindo cliques.");
  else improvements.push("A promessa visual precisa gerar mais curiosidade.");

  if (retention >= 0.5) strengths.push("O público permaneceu assistindo por bastante tempo.");
  else if (retention >= 0.36) {
    improvements.push("O ritmo perde força em alguns trechos do vídeo.");
  } else {
    improvements.push("Gancho, roteiro e edição precisam segurar melhor a atenção.");
  }

  if (likeRate >= 0.045) strengths.push("O conteúdo gerou uma reação positiva acima da média.");
  else improvements.push("Faltou um momento mais memorável para estimular engajamento.");

  if (subscriberRate >= 0.01) {
    strengths.push("O vídeo está convertendo espectadores em inscritos.");
  } else {
    improvements.push("A identidade do canal e a continuidade ainda não estão claras.");
  }

  if (Number(video.internalTrafficViews ?? 0) > video.totalViews * 0.12) {
    strengths.push("O vídeo está levando público para outros conteúdos do canal.");
  }

  const sentiment: AudienceFeedback["sentiment"] =
    score >= 78
      ? "very-positive"
      : score >= 64
        ? "positive"
        : score >= 48
          ? "mixed"
          : "negative";

  const headline =
    sentiment === "very-positive"
      ? "O público considera este um dos melhores vídeos do canal."
      : sentiment === "positive"
        ? "A recepção foi positiva e o vídeo fortaleceu o canal."
        : sentiment === "mixed"
          ? "O vídeo despertou interesse, mas dividiu a atenção do público."
          : "A recepção ficou abaixo do esperado para o potencial do tema.";

  const summary =
    stage === "24h"
      ? "Esta é a leitura inicial das primeiras 24 horas. Os indicadores ainda podem mudar com recomendações, buscas e tráfego interno."
      : "Esta análise considera 72 horas de distribuição e representa uma leitura mais estável da percepção do público.";

  return {
    stage,
    score: clamp(score, 0, 100),
    sentiment,
    headline,
    summary,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    generatedAtAgeHours: video.ageHours
  };
}

function processGrowthEventChecks(
  simulation: GrowthSimulation,
  previousHour: number,
  currentHour: number,
  silent: boolean
): ChannelGain | null {
  if (!simulation.videos.length || currentHour <= previousHour) return null;

  let nextCheck = Number(
    simulation.nextGrowthEventCheckHour ??
      previousHour + EVENT_CHECK_INTERVAL_HOURS
  );
  let combined: ChannelGain | null = null;
  let checks = 0;

  while (nextCheck <= currentHour && checks < 24) {
    checks += 1;
    simulation.nextGrowthEventCheckHour =
      nextCheck + EVENT_CHECK_INTERVAL_HOURS;

    if (nextCheck >= Number(simulation.growthEventCooldownUntil ?? 0)) {
      const chance = calculateEventChance(simulation);
      if (Math.random() < chance) {
        const event = createGrowthEvent(simulation, nextCheck);
        if (event) {
          const gain = applyGrowthEvent(simulation, event, silent);
          combined = combined ?? emptyGain();
          mergeGain(combined, gain);
          simulation.growthEventCooldownUntil =
            nextCheck + EVENT_COOLDOWN_HOURS;
          simulation.growthMissedChecks = 0;
        }
      } else {
        simulation.growthMissedChecks = Math.min(
          8,
          Number(simulation.growthMissedChecks ?? 0) + 1
        );
      }
    }

    nextCheck = Number(simulation.nextGrowthEventCheckHour);
  }

  return combined;
}

function calculateEventChance(simulation: GrowthSimulation): number {
  const state = simulation.host.getState();
  const context = getGrowthContext();
  const averageQuality = average(
    simulation.videos.slice(0, 10).map((video) => video.hiddenQuality)
  );
  const strongestAuthority = Math.max(
    0,
    ...Object.values(simulation.nicheAuthority ?? {}).map(Number)
  );
  const channelStrength = clamp(
    Math.log10(state.subscribers + 10) / 4.2,
    0,
    1
  );
  const creatorStrength = clamp(
    context.skillAverage / 5 * 0.65 +
      context.completedCourses / 6 * 0.18 +
      averageQuality / 100 * 0.17,
    0,
    1
  );
  const pcStrength = clamp(
    context.equipmentAverage / 4 * 0.72 +
      (context.qualityCeiling - 55) / 45 * 0.28,
    0,
    1
  );
  const reputationStrength = clamp(context.reputationAverage / 100, 0, 1);
  const catalogStrength = clamp(simulation.videos.length / 24, 0, 1);
  const missedBonus = Number(simulation.growthMissedChecks ?? 0) * 0.025;

  return clamp(
    0.045 +
      channelStrength * 0.1 +
      creatorStrength * 0.075 +
      pcStrength * 0.05 +
      reputationStrength * 0.05 +
      strongestAuthority / 100 * 0.055 +
      catalogStrength * 0.04 +
      missedBonus,
    0.045,
    0.42
  );
}

function createGrowthEvent(
  simulation: GrowthSimulation,
  channelHour: number
): GrowthEventRecord | null {
  const video = selectEventVideo(simulation);
  if (!video) return null;

  const state = simulation.host.getState();
  const context = getGrowthContext();
  const authority = Number(simulation.nicheAuthority?.[video.themeId] ?? 0);
  const quality = video.hiddenQuality;
  const retention = Number(video.retentionRate ?? 0.35);
  const scale = clamp(
    0.72 +
      Math.log10(state.subscribers + 10) * 0.25 +
      quality / 145 +
      authority / 180 +
      context.skillAverage / 14 +
      context.equipmentAverage / 18,
    0.75,
    4.6
  );

  const available: Array<{ type: GrowthEventType; weight: number }> = [
    { type: "comment-wave", weight: 28 },
    { type: "community-share", weight: 24 },
    { type: "community-discussion", weight: retention >= 0.42 ? 18 : 8 },
    {
      type: "external-citation",
      weight:
        video.themeId === "technology" || video.themeId === "tutorial" ? 20 : 7
    },
    {
      type: "recommendation-burst",
      weight: quality >= 58 && retention >= 0.4 ? 18 : 5
    },
    {
      type: "catalog-rediscovery",
      weight: video.ageHours >= 72 ? 17 : 2
    },
    {
      type: "creator-mention",
      weight:
        state.subscribers >= 100 || quality >= 68 || authority >= 25 ? 12 : 1
    }
  ];

  const type = weightedPick(available);
  const definitions = eventDefinition(type, video, scale);
  const views = randomInt(definitions.views[0], definitions.views[1]);
  const likes = randomInt(definitions.likes[0], definitions.likes[1]);
  const comments = randomInt(definitions.comments[0], definitions.comments[1]);
  const subscribers = randomInt(
    definitions.subscribers[0],
    definitions.subscribers[1]
  );
  const ctr = clamp(Number(video.ctr ?? 0.05), 0.025, 0.18);
  const impressions = Math.max(views, Math.round(views / ctr));
  const watchHours =
    (views * getFormatMinutes(video.formatId) * retention) / 60;
  const revenue =
    state.subscribers >= 1000
      ? views * getRevenuePerView(video.formatId)
      : 0;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: definitions.title,
    description: definitions.description,
    videoId: video.id,
    videoTitle: video.title,
    channelHour,
    day: state.day,
    impressions,
    views,
    likes,
    comments,
    subscribers,
    watchHours,
    revenue,
    impact: views >= 250 || subscribers >= 15 ? "large" : views >= 80 ? "medium" : "small"
  };
}

function eventDefinition(
  type: GrowthEventType,
  video: GrowthVideo,
  scale: number
): {
  title: string;
  description: string;
  views: [number, number];
  likes: [number, number];
  comments: [number, number];
  subscribers: [number, number];
} {
  const scaled = (minimum: number, maximum: number): [number, number] => [
    Math.max(1, Math.round(minimum * scale)),
    Math.max(2, Math.round(maximum * scale))
  ];

  switch (type) {
    case "comment-wave":
      return {
        title: "O vídeo começou a receber comentários",
        description: `Uma sequência de espectadores comentou e respondeu outras pessoas em “${video.title}”.`,
        views: scaled(8, 28),
        likes: scaled(4, 13),
        comments: scaled(3, 10),
        subscribers: scaled(0, 2)
      };
    case "community-share":
      return {
        title: "Compartilharam seu vídeo em uma comunidade",
        description: `O conteúdo foi enviado para um grupo interessado no tema e trouxe uma nova onda de visitas.`,
        views: scaled(18, 72),
        likes: scaled(3, 12),
        comments: scaled(1, 5),
        subscribers: scaled(1, 5)
      };
    case "external-citation":
      return {
        title: "Seu vídeo foi citado em outro site",
        description: `Uma publicação externa usou “${video.title}” como referência e enviou tráfego qualificado ao canal.`,
        views: scaled(28, 115),
        likes: scaled(4, 16),
        comments: scaled(1, 6),
        subscribers: scaled(2, 8)
      };
    case "creator-mention":
      return {
        title: "Outro YouTuber mencionou seu canal",
        description: `Um criador recomendou seu trabalho durante um vídeo e apresentou seu conteúdo para uma audiência maior.`,
        views: scaled(85, 360),
        likes: scaled(12, 48),
        comments: scaled(4, 18),
        subscribers: scaled(6, 24)
      };
    case "recommendation-burst":
      return {
        title: "A plataforma ampliou as recomendações",
        description: `O bom desempenho de clique e retenção fez o algoritmo testar o vídeo com um público maior.`,
        views: scaled(55, 230),
        likes: scaled(9, 34),
        comments: scaled(2, 11),
        subscribers: scaled(4, 16)
      };
    case "catalog-rediscovery":
      return {
        title: "Um vídeo antigo voltou a crescer",
        description: `Buscas e recomendações recuperaram “${video.title}” e reativaram o catálogo do canal.`,
        views: scaled(30, 165),
        likes: scaled(5, 22),
        comments: scaled(1, 8),
        subscribers: scaled(2, 10)
      };
    case "community-discussion":
      return {
        title: "O tema gerou uma discussão entre espectadores",
        description: `As pessoas continuaram a conversa nos comentários, aumentando o tempo de sessão e o engajamento.`,
        views: scaled(20, 92),
        likes: scaled(7, 25),
        comments: scaled(5, 16),
        subscribers: scaled(1, 7)
      };
  }
}

function applyGrowthEvent(
  simulation: GrowthSimulation,
  event: GrowthEventRecord,
  silent: boolean
): ChannelGain {
  const video = simulation.videos.find((item) => item.id === event.videoId);
  if (!video) return emptyGain();

  video.totalImpressions = Number(video.totalImpressions ?? 0) + event.impressions;
  video.totalClicks = Number(video.totalClicks ?? 0) + event.views;
  video.totalViews += event.views;
  video.totalWatchHours =
    Number(video.totalWatchHours ?? 0) + event.watchHours;
  video.totalLikes += event.likes;
  video.totalComments = Number(video.totalComments ?? 0) + event.comments;
  video.totalSubscribers += event.subscribers;
  video.totalRevenue += event.revenue;

  const state = simulation.host.getState();
  state.totalViews += event.views;
  state.subscribers += event.subscribers;
  state.money += event.revenue;

  simulation.growthEvents = [
    event,
    ...(simulation.growthEvents ?? [])
  ].slice(0, MAX_EVENT_HISTORY);
  simulation.nicheAuthority[video.themeId] = clamp(
    Number(simulation.nicheAuthority[video.themeId] ?? 0) +
      event.views / 1200 +
      event.subscribers * 0.035 +
      event.comments * 0.018,
    0,
    100
  );
  simulation.host.onChange();

  const gain: ChannelGain = {
    impressions: event.impressions,
    clicks: event.views,
    views: event.views,
    watchHours: event.watchHours,
    internalViews: 0,
    likes: event.likes,
    subscribers: event.subscribers,
    revenue: event.revenue,
    sourceVideoId: event.videoId,
    sourceTitle: event.title
  };

  if (!silent) {
    simulation.host.onGain(gain);
    document.dispatchEvent(
      new CustomEvent("creator-life-growth-event", { detail: event })
    );
  }

  return gain;
}

function selectEventVideo(simulation: GrowthSimulation): GrowthVideo | null {
  const candidates = simulation.videos.filter((video) => video.ageHours >= 4);
  if (!candidates.length) return simulation.videos[0] ?? null;

  const weighted = candidates.map((video) => {
    const freshness = video.ageHours < 72 ? 1.45 : video.ageHours < 240 ? 1 : 0.7;
    const quality = 0.55 + video.hiddenQuality / 80;
    const authority =
      0.75 + Number(simulation.nicheAuthority?.[video.themeId] ?? 0) / 100;
    return { video, weight: freshness * quality * authority };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.video;
  }
  return weighted[weighted.length - 1]?.video ?? null;
}

function renderGrowthInsights(simulation: GrowthSimulation): string {
  const context = getGrowthContext();
  const chance = calculateEventChance(simulation);
  const events = simulation.growthEvents ?? [];
  const feedbackVideos = simulation.videos.filter(
    (video) => video.audienceFeedback || video.ageHours < 72
  );
  const positiveCount = simulation.videos.filter((video) =>
    ["very-positive", "positive"].includes(
      video.audienceFeedback?.sentiment ?? ""
    )
  ).length;

  return `
    <section class="growth-insights-overview">
      <div class="channel-section-heading"><div><span>CRESCIMENTO ORGÂNICO</span><h3>Eventos e percepção do público</h3></div><small>Eventos acontecem automaticamente conforme canal, habilidades, equipamento, reputação e autoridade evoluem.</small></div>
      <div class="growth-potential-grid">
        <article><span>Chance atual</span><strong>${growthChanceLabel(chance)}</strong><p>${Math.round(chance * 100)}% por verificação de distribuição</p></article>
        <article><span>Eventos registrados</span><strong>${events.length}</strong><p>Compartilhamentos, citações, comentários e menções</p></article>
        <article><span>Recepção positiva</span><strong>${positiveCount}/${simulation.videos.length}</strong><p>Vídeos com avaliação positiva após análise</p></article>
        <article><span>Estrutura do criador</span><strong>${Math.round((context.skillAverage / 5) * 100)}%</strong><p>Habilidades, cursos e capacidade técnica</p></article>
      </div>
    </section>
    <section class="audience-feedback-section">
      <div class="channel-section-heading"><div><span>FEEDBACK APÓS A PUBLICAÇÃO</span><h3>O que o público achou</h3></div><small>A primeira análise aparece após 24h e amadurece após 72h.</small></div>
      <div class="audience-feedback-grid">${
        feedbackVideos.length
          ? feedbackVideos.slice(0, 8).map(renderFeedbackCard).join("")
          : '<div class="growth-empty-card"><strong>Nenhum feedback disponível</strong><p>Publique um vídeo e aguarde as primeiras 24 horas de distribuição.</p></div>'
      }</div>
    </section>
    <section class="growth-event-history">
      <div class="channel-section-heading"><div><span>HISTÓRICO DE EVENTOS</span><h3>Como o canal está sendo descoberto</h3></div><small>Os ganhos são somados a impressões, views, engajamento, tempo assistido e inscritos.</small></div>
      <div class="growth-event-list">${
        events.length
          ? events.slice(0, 12).map(renderGrowthEvent).join("")
          : '<div class="growth-empty-card"><strong>Nenhum evento ainda</strong><p>O primeiro evento pode surgir quando um vídeo acumular algumas horas de distribuição.</p></div>'
      }</div>
    </section>
  `;
}

function renderFeedbackCard(video: GrowthVideo): string {
  const feedback = video.audienceFeedback;
  if (!feedback) {
    const remaining = Math.max(0, 24 - video.ageHours);
    return `
      <article class="audience-feedback-card is-waiting">
        <div class="audience-feedback-card__top"><span>ANÁLISE EM ANDAMENTO</span><strong>${Math.ceil(remaining)}h restantes</strong></div>
        <h4>${escapeHtml(video.title)}</h4>
        <p>A plataforma ainda está reunindo cliques, retenção, engajamento e conversão suficientes para avaliar o vídeo.</p>
        <div class="feedback-progress"><i style="width:${clamp((video.ageHours / 24) * 100, 0, 100)}%"></i></div>
      </article>`;
  }

  return `
    <article class="audience-feedback-card" data-sentiment="${feedback.sentiment}">
      <div class="audience-feedback-card__top"><span>${feedback.stage === "72h" ? "ANÁLISE CONSOLIDADA" : "PRIMEIRAS 24 HORAS"}</span><strong>${feedback.score}/100</strong></div>
      <h4>${escapeHtml(video.title)}</h4>
      <b>${escapeHtml(feedback.headline)}</b>
      <p>${escapeHtml(feedback.summary)}</p>
      <div class="feedback-columns">
        <div><span>PONTOS FORTES</span>${feedback.strengths.map((item) => `<small>+ ${escapeHtml(item)}</small>`).join("") || "<small>O vídeo ainda não apresentou um diferencial claro.</small>"}</div>
        <div><span>COMO MELHORAR</span>${feedback.improvements.map((item) => `<small>• ${escapeHtml(item)}</small>`).join("") || "<small>Mantenha o padrão atual e construa uma série.</small>"}</div>
      </div>
    </article>`;
}

function renderGrowthEvent(event: GrowthEventRecord): string {
  return `
    <article class="growth-event-card" data-impact="${event.impact}">
      <div class="growth-event-card__icon">${eventIcon(event.type)}</div>
      <div class="growth-event-card__content">
        <div><span>DIA ${event.day}</span><strong>${escapeHtml(event.title)}</strong></div>
        <p>${escapeHtml(event.description)}</p>
        <small>${escapeHtml(event.videoTitle)}</small>
      </div>
      <div class="growth-event-card__metrics">
        <span>+${event.views.toLocaleString("pt-BR")} views</span>
        <span>+${event.likes.toLocaleString("pt-BR")} likes</span>
        <span>+${event.comments.toLocaleString("pt-BR")} comentários</span>
        <strong>+${event.subscribers.toLocaleString("pt-BR")} inscritos</strong>
      </div>
    </article>`;
}

function installEventNotifications(): void {
  document.addEventListener("creator-life-growth-event", (event) => {
    const detail = (event as CustomEvent<GrowthEventRecord>).detail;
    const container = document.getElementById("game-container");
    if (!container || !detail) return;

    let stack = container.querySelector<HTMLElement>(".growth-event-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "growth-event-toast-stack";
      container.append(stack);
    }

    const card = document.createElement("article");
    card.className = "growth-event-toast";
    card.dataset.impact = detail.impact;
    card.innerHTML = `
      <div class="growth-event-toast__icon">${eventIcon(detail.type)}</div>
      <div><span>EVENTO DO CANAL</span><strong>${escapeHtml(detail.title)}</strong><p>+${detail.views.toLocaleString("pt-BR")} views · +${detail.subscribers.toLocaleString("pt-BR")} inscritos</p></div>`;
    stack.prepend(card);
    requestAnimationFrame(() => card.classList.add("is-visible"));
    window.setTimeout(() => {
      card.classList.remove("is-visible");
      window.setTimeout(() => card.remove(), 280);
    }, 5200);
  });

  document.addEventListener("creator-life-feedback-ready", (event) => {
    const video = (event as CustomEvent<GrowthVideo>).detail;
    const container = document.getElementById("game-container");
    const toast = container?.querySelector<HTMLElement>(".game-toast");
    if (!toast || !video?.audienceFeedback) return;
    toast.textContent = `Novo insight: “${video.title}” recebeu nota ${video.audienceFeedback.score}/100.`;
    toast.dataset.type =
      video.audienceFeedback.score >= 64 ? "success" : "neutral";
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
  });
}

function emitFeedbackReady(video: GrowthVideo): void {
  document.dispatchEvent(
    new CustomEvent("creator-life-feedback-ready", { detail: video })
  );
}

function getGrowthContext(): GrowthContext {
  return (
    window.__creatorLifeGrowthContext?.() ?? {
      skillAverage: 0,
      equipmentAverage: 0,
      reputationAverage: 0,
      qualityCeiling: 62,
      completedCourses: 0
    }
  );
}

function growthChanceLabel(chance: number): string {
  if (chance >= 0.32) return "Muito alta";
  if (chance >= 0.23) return "Alta";
  if (chance >= 0.14) return "Moderada";
  if (chance >= 0.08) return "Baixa";
  return "Inicial";
}

function eventIcon(type: GrowthEventType): string {
  switch (type) {
    case "comment-wave":
      return "●●";
    case "community-share":
      return "↗";
    case "external-citation":
      return "⌁";
    case "creator-mention":
      return "▶";
    case "recommendation-burst":
      return "▲";
    case "catalog-rediscovery":
      return "↻";
    case "community-discussion":
      return "◇";
  }
}

function getFormatMinutes(formatId: string): number {
  if (formatId === "short") return 0.75;
  if (formatId === "review") return 11;
  if (formatId === "documentary") return 19;
  return 8;
}

function getRevenuePerView(formatId: string): number {
  if (formatId === "short") return 0.00065;
  if (formatId === "review") return 0.0026;
  if (formatId === "documentary") return 0.0031;
  return 0.0018;
}

function weightedPick(
  options: Array<{ type: GrowthEventType; weight: number }>
): GrowthEventType {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.type;
  }
  return options[options.length - 1].type;
}

function randomInt(minimum: number, maximum: number): number {
  const low = Math.min(minimum, maximum);
  const high = Math.max(minimum, maximum);
  return Math.floor(low + Math.random() * (high - low + 1));
}

function mergeGain(target: ChannelGain, source: ChannelGain): void {
  target.impressions = Number(target.impressions ?? 0) + Number(source.impressions ?? 0);
  target.clicks = Number(target.clicks ?? 0) + Number(source.clicks ?? 0);
  target.views += source.views;
  target.watchHours = Number(target.watchHours ?? 0) + Number(source.watchHours ?? 0);
  target.internalViews = Number(target.internalViews ?? 0) + Number(source.internalViews ?? 0);
  target.likes += source.likes;
  target.subscribers += source.subscribers;
  target.revenue += source.revenue;
  if (source.sourceVideoId) {
    target.sourceVideoId = source.sourceVideoId;
    target.sourceTitle = source.sourceTitle;
  }
}

function emptyGain(): ChannelGain {
  return {
    impressions: 0,
    clicks: 0,
    views: 0,
    watchHours: 0,
    internalViews: 0,
    likes: 0,
    subscribers: 0,
    revenue: 0,
    sourceVideoId: null,
    sourceTitle: "Canal"
  };
}

function average(values: number[]): number {
  const valid = values.filter(Number.isFinite);
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

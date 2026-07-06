import { FORMATS, THEMES, THUMBNAILS } from "../game/videoData";
import type {
  ChannelGain,
  ChannelSimulationSave,
  FormatOption,
  PlayerState,
  PublishedVideo,
  VideoDraft,
  VideoResult
} from "../game/types";

interface ChannelSimulationHost {
  getState: () => PlayerState;
  onGain: (gain: ChannelGain) => void;
  onChange: () => void;
}

const LIVE_TICK_MS = 1100;
const CHANNEL_HOURS_PER_TICK = 2;
const MAX_OFFLINE_HOURS = 720;

export class ChannelSimulation {
  private readonly host: ChannelSimulationHost;
  private videos: PublishedVideo[] = [];
  private channelHours = 0;
  private timer: number | null = null;

  public constructor(host: ChannelSimulationHost) {
    this.host = host;
  }

  public start(): void {
    if (this.timer !== null) {
      return;
    }

    this.timer = window.setInterval(() => {
      this.advance(CHANNEL_HOURS_PER_TICK);
    }, LIVE_TICK_MS);
  }

  public stop(): void {
    if (this.timer === null) {
      return;
    }

    window.clearInterval(this.timer);
    this.timer = null;
  }

  public addVideo(
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ): PublishedVideo {
    if (!draft.themeId || !draft.thumbnailId) {
      throw new Error("Não é possível publicar um vídeo incompleto.");
    }

    const state = this.host.getState();
    const theme = THEMES.find((item) => item.id === draft.themeId);
    const thumbnail = THUMBNAILS.find((item) => item.id === draft.thumbnailId);
    const evergreenFactor = this.getEvergreenFactor(draft.themeId, format.id);
    const trendVariation = 0.78 + Math.random() * 0.58;
    const hiddenTrend = theme ? 0.78 + theme.trend / 34 : 1;
    const rareViralRoll = Math.random();
    const viralFactor =
      rareViralRoll > 0.985
        ? 4.2 + Math.random() * 2.2
        : rareViralRoll > 0.93
          ? 1.55 + Math.random() * 0.85
          : 0.86 + Math.random() * 0.34;

    const video: PublishedVideo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title,
      themeId: draft.themeId,
      formatId: format.id,
      thumbnailId: draft.thumbnailId,
      editingOrder: [...draft.editingOrder],
      publishedDay: state.day,
      publishedHour: state.hour,
      ageHours: 0,
      subscribersAtPublish: state.subscribers,
      hiddenQuality: result.quality,
      hiddenPlanningScore: result.planningScore,
      hiddenEditingScore: result.editingScore,
      hiddenTitleScore: result.titleScore,
      initialMomentum:
        (0.72 + result.planningScore / 115) *
        format.reachMultiplier *
        (thumbnail ? 0.86 + thumbnail.clickBonus / 42 : 1),
      evergreenFactor,
      trendFactor: trendVariation * hiddenTrend,
      viralFactor,
      totalViews: 0,
      totalLikes: 0,
      totalSubscribers: 0,
      totalRevenue: 0,
      viewRemainder: 0,
      likeRemainder: 0,
      subscriberRemainder: 0,
      revenueRemainder: 0
    };

    this.videos.unshift(video);
    this.host.onChange();
    return video;
  }

  public advance(hours: number, silent = false): ChannelGain {
    const safeHours = Math.max(0, Math.min(hours, MAX_OFFLINE_HOURS));
    const aggregate: ChannelGain = {
      views: 0,
      likes: 0,
      subscribers: 0,
      revenue: 0,
      sourceVideoId: null,
      sourceTitle: "Canal"
    };

    if (safeHours <= 0 || this.videos.length === 0) {
      this.channelHours += safeHours;
      return aggregate;
    }

    const sourceGains = new Map<string, number>();
    const steps = Math.max(1, Math.ceil(safeHours));
    const stepHours = safeHours / steps;

    for (let step = 0; step < steps; step += 1) {
      for (const video of this.videos) {
        const gain = this.processVideo(video, stepHours);

        aggregate.views += gain.views;
        aggregate.likes += gain.likes;
        aggregate.subscribers += gain.subscribers;
        aggregate.revenue += gain.revenue;

        if (gain.views > 0) {
          sourceGains.set(
            video.id,
            (sourceGains.get(video.id) ?? 0) + gain.views
          );
        }
      }

      this.channelHours += stepHours;
    }

    const state = this.host.getState();
    state.totalViews += aggregate.views;
    state.subscribers += aggregate.subscribers;
    state.money += aggregate.revenue;

    const strongestSource = [...sourceGains.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0];

    if (strongestSource) {
      const video = this.videos.find((item) => item.id === strongestSource[0]);
      aggregate.sourceVideoId = video?.id ?? null;
      aggregate.sourceTitle = video?.title ?? "Canal";
    }

    if (
      aggregate.views > 0 ||
      aggregate.likes > 0 ||
      aggregate.subscribers > 0 ||
      aggregate.revenue > 0
    ) {
      this.host.onChange();

      if (!silent) {
        this.host.onGain(aggregate);
      }
    }

    return aggregate;
  }

  public serialize(): ChannelSimulationSave {
    return {
      videos: this.videos.map((video) => ({
        ...video,
        editingOrder: [...video.editingOrder]
      })),
      channelHours: this.channelHours,
      lastSavedAt: Date.now()
    };
  }

  public restore(save: Partial<ChannelSimulationSave> | null): ChannelGain {
    if (!save) {
      return {
        views: 0,
        likes: 0,
        subscribers: 0,
        revenue: 0,
        sourceVideoId: null,
        sourceTitle: "Canal"
      };
    }

    this.videos = Array.isArray(save.videos)
      ? save.videos.map((video) => this.normalizeVideo(video))
      : [];
    this.channelHours = Number.isFinite(save.channelHours)
      ? Number(save.channelHours)
      : 0;

    const elapsedMilliseconds = Math.max(
      0,
      Date.now() - Number(save.lastSavedAt ?? Date.now())
    );
    const offlineHours = Math.min(
      MAX_OFFLINE_HOURS,
      (elapsedMilliseconds / 60_000) * 24
    );

    return this.advance(offlineHours, true);
  }

  public getVideos(): PublishedVideo[] {
    return this.videos.map((video) => ({
      ...video,
      editingOrder: [...video.editingOrder]
    }));
  }

  public renderLibraryHtml(): string {
    if (this.videos.length === 0) {
      return `
        <div class="video-library-empty">
          <strong>Nenhum vídeo publicado</strong>
          <p>Crie seu primeiro vídeo para começar a construir um catálogo que continua gerando resultados com o tempo.</p>
        </div>
      `;
    }

    const totalLikes = this.videos.reduce(
      (sum, video) => sum + video.totalLikes,
      0
    );
    const activeVideos = this.videos.filter(
      (video) => video.ageHours < 24 * 30
    ).length;

    return `
      <div class="library-summary">
        <div><span>Catálogo</span><strong>${this.videos.length} vídeos</strong></div>
        <div><span>Likes acumulados</span><strong>${totalLikes.toLocaleString("pt-BR")}</strong></div>
        <div><span>Vídeos recentes</span><strong>${activeVideos}</strong></div>
      </div>
      <div class="video-library-list">
        ${this.videos
          .map((video) => {
            const theme = THEMES.find((item) => item.id === video.themeId);
            const format = FORMATS.find((item) => item.id === video.formatId);
            const activityLabel = this.getActivityLabel(video);

            return `
              <article class="video-library-card">
                <div class="video-library-card__preview" style="--library-accent: ${this.toHex(
                  theme?.color ?? 0x38bdf8
                )}">
                  <span>${format?.label ?? "Vídeo"}</span>
                  <strong>${theme?.label ?? "Conteúdo"}</strong>
                </div>
                <div class="video-library-card__content">
                  <div class="video-library-card__title">
                    <div>
                      <span>${this.getAgeLabel(video.ageHours)}</span>
                      <h4>${this.escapeHtml(video.title)}</h4>
                    </div>
                    <small class="video-activity-tag">${activityLabel}</small>
                  </div>
                  <div class="video-library-card__metrics">
                    <div><span>Views</span><strong>${video.totalViews.toLocaleString("pt-BR")}</strong></div>
                    <div><span>Likes</span><strong>${video.totalLikes.toLocaleString("pt-BR")}</strong></div>
                    <div><span>Inscritos</span><strong>+${video.totalSubscribers.toLocaleString("pt-BR")}</strong></div>
                    <div><span>Receita</span><strong>R$ ${video.totalRevenue.toFixed(2)}</strong></div>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  private processVideo(
    video: PublishedVideo,
    hours: number
  ): ChannelGain {
    const midpointAge = video.ageHours + hours / 2;
    const freshness = Math.exp(-midpointAge / 34) * 1.95;
    const discovery = Math.exp(-midpointAge / 360) * 0.24;
    const longTail =
      video.evergreenFactor *
      (0.055 + 0.24 / Math.sqrt(midpointAge / 24 + 1));
    const periodicDiscovery =
      Math.sin((midpointAge + this.channelHours) / 17) > 0.94 ? 1.28 : 1;
    const qualityPower = 0.65 + video.hiddenQuality / 32;
    const channelPower =
      0.72 + Math.sqrt(video.subscribersAtPublish + 1) * 0.055;
    const noise = 0.76 + Math.random() * 0.48;
    const rawViews =
      qualityPower *
      channelPower *
      video.initialMomentum *
      video.trendFactor *
      video.viralFactor *
      (freshness + discovery + longTail) *
      periodicDiscovery *
      noise *
      hours;

    video.viewRemainder += Math.max(0, rawViews);
    const views = Math.floor(video.viewRemainder);
    video.viewRemainder -= views;

    const likeRate =
      0.032 +
      video.hiddenQuality * 0.00052 +
      video.hiddenEditingScore * 0.00016;
    const subscriberRate =
      0.004 +
      video.hiddenQuality * 0.0002 +
      video.hiddenPlanningScore * 0.000055;

    video.likeRemainder += views * likeRate;
    video.subscriberRemainder += views * subscriberRate;

    const likes = Math.floor(video.likeRemainder);
    const subscribers = Math.floor(video.subscriberRemainder);
    video.likeRemainder -= likes;
    video.subscriberRemainder -= subscribers;

    const state = this.host.getState();
    const revenuePerView = state.subscribers >= 1000 ? 0.006 : 0;
    video.revenueRemainder += views * revenuePerView;
    const revenue = Math.floor(video.revenueRemainder * 100) / 100;
    video.revenueRemainder -= revenue;

    video.totalViews += views;
    video.totalLikes += likes;
    video.totalSubscribers += subscribers;
    video.totalRevenue += revenue;
    video.ageHours += hours;

    return {
      views,
      likes,
      subscribers,
      revenue,
      sourceVideoId: video.id,
      sourceTitle: video.title
    };
  }

  private getEvergreenFactor(
    themeId: PublishedVideo["themeId"],
    formatId: PublishedVideo["formatId"]
  ): number {
    const themeFactor =
      themeId === "tutorial"
        ? 1.55
        : themeId === "technology"
          ? 1.18
          : themeId === "games"
            ? 0.92
            : themeId === "vlog"
              ? 0.76
              : 0.66;
    const formatFactor =
      formatId === "documentary"
        ? 1.28
        : formatId === "review"
          ? 1.18
          : formatId === "standard"
            ? 1
            : 0.58;

    return themeFactor * formatFactor;
  }

  private getActivityLabel(video: PublishedVideo): string {
    if (video.ageHours < 24) {
      return "Primeiras horas";
    }

    if (video.ageHours < 24 * 7) {
      return "Em lançamento";
    }

    if (video.ageHours < 24 * 30) {
      return "Ainda recomendado";
    }

    if (video.evergreenFactor >= 1.2) {
      return "Busca contínua";
    }

    return "Cauda longa";
  }

  private getAgeLabel(hours: number): string {
    if (hours < 1) {
      return "Publicado agora";
    }

    if (hours < 24) {
      return `Há ${Math.floor(hours)}h`;
    }

    const days = Math.floor(hours / 24);

    if (days < 30) {
      return `Há ${days} dia${days === 1 ? "" : "s"}`;
    }

    const months = Math.floor(days / 30);

    if (months < 12) {
      return `Há ${months} ${months === 1 ? "mês" : "meses"}`;
    }

    const years = Math.floor(months / 12);
    return `Há ${years} ano${years === 1 ? "" : "s"}`;
  }

  private normalizeVideo(video: PublishedVideo): PublishedVideo {
    return {
      ...video,
      editingOrder: Array.isArray(video.editingOrder)
        ? [...video.editingOrder]
        : [],
      ageHours: Number(video.ageHours ?? 0),
      totalViews: Number(video.totalViews ?? 0),
      totalLikes: Number(video.totalLikes ?? 0),
      totalSubscribers: Number(video.totalSubscribers ?? 0),
      totalRevenue: Number(video.totalRevenue ?? 0),
      viewRemainder: Number(video.viewRemainder ?? 0),
      likeRemainder: Number(video.likeRemainder ?? 0),
      subscriberRemainder: Number(video.subscriberRemainder ?? 0),
      revenueRemainder: Number(video.revenueRemainder ?? 0)
    };
  }

  private toHex(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

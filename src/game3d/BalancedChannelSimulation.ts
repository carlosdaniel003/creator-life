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

const LIVE_TICK_MS = 2200;
const CHANNEL_HOURS_PER_TICK = 1;
const MAX_OFFLINE_HOURS = 336;

export class BalancedChannelSimulation {
  private readonly host: ChannelSimulationHost;
  private videos: PublishedVideo[] = [];
  private channelHours = 0;
  private timer: number | null = null;

  public constructor(host: ChannelSimulationHost) {
    this.host = host;
  }

  public start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(
      () => this.advance(CHANNEL_HOURS_PER_TICK),
      LIVE_TICK_MS
    );
  }

  public stop(): void {
    if (this.timer === null) return;
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
    const cadenceFactor = this.calculateCadenceFactor(state.day, state.hour);
    const trendFactor =
      (0.78 + Math.random() * 0.38) *
      (theme ? 0.9 + theme.trend / 100 : 1);
    const viralRoll = Math.random();
    const viralFactor =
      viralRoll > 0.998
        ? 5 + Math.random() * 3
        : viralRoll > 0.975
          ? 1.5 + Math.random() * 1.15
          : 0.82 + Math.random() * 0.28;
    const thumbnailFactor = thumbnail
      ? 0.82 + Math.max(0, thumbnail.clickBonus) / 45
      : 1;

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
        (0.14 + result.planningScore / 190) *
        format.reachMultiplier *
        thumbnailFactor,
      evergreenFactor: this.getEvergreenFactor(draft.themeId, format.id),
      trendFactor,
      viralFactor,
      cadenceFactor,
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
      const currentConsistency = this.getCurrentConsistency();

      for (const video of this.videos) {
        const gain = this.processVideo(video, stepHours, currentConsistency);
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
      if (!silent) this.host.onGain(aggregate);
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
    if (!save) return this.emptyGain();

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
      (elapsedMilliseconds / 60_000) * 12
    );

    return this.advance(offlineHours, true);
  }

  public renderLibraryHtml(): string {
    if (this.videos.length === 0) {
      return `
        <div class="video-library-empty">
          <strong>Nenhum vídeo publicado</strong>
          <p>Um canal sustentável exige dezenas de vídeos, consistência e tempo para formar um catálogo.</p>
        </div>
      `;
    }

    const totalLikes = this.videos.reduce(
      (sum, video) => sum + video.totalLikes,
      0
    );
    const totalRevenue = this.videos.reduce(
      (sum, video) => sum + video.totalRevenue,
      0
    );
    const consistency = this.getCurrentConsistency();

    return `
      <div class="library-summary">
        <div><span>Catálogo</span><strong>${this.videos.length} vídeos</strong></div>
        <div><span>Likes acumulados</span><strong>${totalLikes.toLocaleString("pt-BR")}</strong></div>
        <div><span>Receita do canal</span><strong>R$ ${totalRevenue.toFixed(2)}</strong></div>
      </div>
      <div class="channel-consistency-card">
        <div><span>Consistência recente</span><strong>${Math.round(consistency * 100)}%</strong></div>
        <p>${this.getConsistencyMessage(consistency)}</p>
      </div>
      <div class="video-library-list">
        ${this.videos.map((video) => this.renderVideoCard(video)).join("")}
      </div>
    `;
  }

  private processVideo(
    video: PublishedVideo,
    hours: number,
    currentConsistency: number
  ): ChannelGain {
    const midpointAge = video.ageHours + hours / 2;
    const freshness = Math.exp(-midpointAge / 52) * 0.52;
    const discovery = Math.exp(-midpointAge / 900) * 0.055;
    const longTail =
      video.evergreenFactor *
      (0.006 + 0.04 / Math.sqrt(midpointAge / 24 + 1));
    const rediscovery =
      Math.sin((midpointAge + this.channelHours) / 43) > 0.985 ? 1.35 : 1;
    const qualityPower = 0.16 + (video.hiddenQuality / 100) * 1.22;
    const channelPower =
      0.15 + Math.log10(video.subscribersAtPublish + 10) * 0.2;
    const noise = 0.72 + Math.random() * 0.5;
    const consistencyBlend =
      video.cadenceFactor * 0.62 + currentConsistency * 0.38;
    const rawViews =
      qualityPower *
      channelPower *
      video.initialMomentum *
      video.trendFactor *
      video.viralFactor *
      consistencyBlend *
      (freshness + discovery + longTail) *
      rediscovery *
      noise *
      hours *
      4.1;

    video.viewRemainder += Math.max(0, rawViews);
    const views = Math.floor(video.viewRemainder);
    video.viewRemainder -= views;

    const likeRate =
      0.011 +
      video.hiddenQuality * 0.00028 +
      video.hiddenEditingScore * 0.000055;
    const subscriberRate =
      0.00022 +
      video.hiddenQuality * 0.000022 +
      video.hiddenPlanningScore * 0.0000045;

    video.likeRemainder += views * likeRate;
    video.subscriberRemainder += views * subscriberRate;

    const likes = Math.floor(video.likeRemainder);
    const subscribers = Math.floor(video.subscriberRemainder);
    video.likeRemainder -= likes;
    video.subscriberRemainder -= subscribers;

    const state = this.host.getState();
    const revenuePerView =
      state.subscribers >= 1000
        ? this.getRevenuePerView(video.formatId)
        : 0;
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

  private calculateCadenceFactor(day: number, hour: number): number {
    if (this.videos.length === 0) return 0.66;

    const now = day * 24 + hour;
    const recent = this.videos.filter(
      (video) => now - (video.publishedDay * 24 + video.publishedHour) <= 14 * 24
    );
    const latest = this.videos[0];
    const gapDays =
      (now - (latest.publishedDay * 24 + latest.publishedHour)) / 24;

    if (recent.length > 7) return 0.82;
    if (recent.length >= 3 && recent.length <= 6 && gapDays <= 5) return 1.12;
    if (recent.length >= 2 && gapDays <= 8) return 1;
    if (gapDays > 21) return 0.62;
    if (gapDays > 12) return 0.76;
    return 0.88;
  }

  private getCurrentConsistency(): number {
    if (this.videos.length === 0) return 0.62;

    const newestAgeDays = this.videos[0].ageHours / 24;
    const recentCount = this.videos.filter(
      (video) => video.ageHours <= 14 * 24
    ).length;

    if (recentCount >= 3 && recentCount <= 6 && newestAgeDays <= 5) return 1.08;
    if (recentCount >= 2 && newestAgeDays <= 8) return 0.98;
    if (recentCount > 7) return 0.84;
    if (newestAgeDays > 21) return 0.58;
    if (newestAgeDays > 12) return 0.72;
    return 0.86;
  }

  private getConsistencyMessage(value: number): string {
    if (value >= 1.05) {
      return "Boa frequência: o público está se acostumando com sua rotina de publicação.";
    }
    if (value >= 0.92) {
      return "Frequência aceitável. Manter duas ou três boas publicações por semana ajuda o catálogo.";
    }
    if (value >= 0.75) {
      return "O canal está irregular. Intervalos longos reduzem a força das próximas publicações.";
    }
    return "Canal inativo. Retomar a frequência exigirá várias publicações consistentes.";
  }

  private getRevenuePerView(formatId: PublishedVideo["formatId"]): number {
    switch (formatId) {
      case "short":
        return 0.00065;
      case "review":
        return 0.0026;
      case "documentary":
        return 0.0031;
      default:
        return 0.0018;
    }
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
            ? 0.9
            : themeId === "vlog"
              ? 0.72
              : 0.64;
    const formatFactor =
      formatId === "documentary"
        ? 1.3
        : formatId === "review"
          ? 1.2
          : formatId === "standard"
            ? 1
            : 0.52;
    return themeFactor * formatFactor;
  }

  private renderVideoCard(video: PublishedVideo): string {
    const theme = THEMES.find((item) => item.id === video.themeId);
    const format = FORMATS.find((item) => item.id === video.formatId);

    return `
      <article class="video-library-card">
        <div class="video-library-card__preview">
          <span>${format?.label ?? "Vídeo"}</span>
          <strong>${theme?.label ?? "Conteúdo"}</strong>
        </div>
        <div class="video-library-card__content">
          <div class="video-library-card__title">
            <div><span>${this.getAgeLabel(video.ageHours)}</span><h4>${this.escapeHtml(video.title)}</h4></div>
            <small class="video-activity-tag">${this.getActivityLabel(video)}</small>
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
  }

  private getActivityLabel(video: PublishedVideo): string {
    if (video.ageHours < 24) return "Primeiro dia";
    if (video.ageHours < 24 * 7) return "Lançamento";
    if (video.ageHours < 24 * 30) return "Catálogo recente";
    if (video.evergreenFactor >= 1.2) return "Busca contínua";
    return "Cauda longa";
  }

  private getAgeLabel(hours: number): string {
    if (hours < 1) return "Publicado agora";
    if (hours < 24) return `Há ${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Há ${days} dia${days === 1 ? "" : "s"}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Há ${months} ${months === 1 ? "mês" : "meses"}`;
    const years = Math.floor(months / 12);
    return `Há ${years} ano${years === 1 ? "" : "s"}`;
  }

  private normalizeVideo(video: PublishedVideo): PublishedVideo {
    return {
      ...video,
      editingOrder: Array.isArray(video.editingOrder)
        ? [...video.editingOrder]
        : [],
      cadenceFactor: Number(video.cadenceFactor ?? 0.82),
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

  private emptyGain(): ChannelGain {
    return {
      views: 0,
      likes: 0,
      subscribers: 0,
      revenue: 0,
      sourceVideoId: null,
      sourceTitle: "Canal"
    };
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

import { FORMATS, THEMES, THUMBNAILS } from "../game/videoData";
import type {
  ChannelGain,
  ChannelSimulationSave,
  FormatOption,
  PlayerState,
  PublishedVideo,
  ThemeId,
  VideoDraft,
  VideoResult
} from "../game/types";
import "../channel-dashboard.css";

interface ChannelSimulationHost {
  getState: () => PlayerState;
  onGain: (gain: ChannelGain) => void;
  onChange: () => void;
}

const LIVE_TICK_MS = 2200;
const CHANNEL_HOURS_PER_TICK = 1;
const MAX_OFFLINE_HOURS = 336;
const THEME_IDS: ThemeId[] = [
  "games",
  "technology",
  "vlog",
  "tutorial",
  "challenge"
];
const THEME_LABELS: Record<ThemeId, string> = {
  games: "Games",
  technology: "Tecnologia",
  vlog: "Vlog",
  tutorial: "Tutoriais",
  challenge: "Desafios"
};

export class BalancedChannelSimulation {
  private readonly host: ChannelSimulationHost;
  private videos: PublishedVideo[] = [];
  private channelHours = 0;
  private timer: number | null = null;
  private nicheAuthority: Record<ThemeId, number> = this.createDefaultAuthority();

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
    const thumbnail = THUMBNAILS.find(
      (item) => item.id === draft.thumbnailId
    );
    const cadenceFactor = this.calculateCadenceFactor(state.day, state.hour);
    const trendFactor =
      (0.84 + Math.random() * 0.32) *
      (theme ? 0.9 + theme.trend / 100 : 1);
    const viralRoll = Math.random();
    const viralFactor =
      viralRoll > 0.997
        ? 4.5 + Math.random() * 3.2
        : viralRoll > 0.965
          ? 1.45 + Math.random() * 1.25
          : 0.88 + Math.random() * 0.24;
    const thumbnailFactor = thumbnail
      ? 0.92 + Math.max(0, thumbnail.clickBonus) / 52
      : 1;
    const related = this.videos.filter(
      (video) => video.themeId === draft.themeId
    );
    const seriesVideos = related.filter(
      (video) => video.formatId === format.id
    );
    const complementaryVideos = related.filter(
      (video) => video.formatId !== format.id
    );
    const authorityAtPublish = this.nicheAuthority[draft.themeId];
    const libraryFactor = this.getLibraryEffect();
    const seriesFactor = 1 + Math.min(0.32, seriesVideos.length * 0.055);
    const complementaryFactor =
      1 + Math.min(0.24, complementaryVideos.length * 0.04);
    const retentionRate = this.calculateRetentionRate(result, format.id);
    const ctr = this.calculateCtr(result, thumbnail?.clickBonus ?? 0);

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
        (0.62 + result.planningScore / 115) *
        format.reachMultiplier *
        thumbnailFactor,
      evergreenFactor: this.getEvergreenFactor(draft.themeId, format.id),
      trendFactor,
      viralFactor,
      cadenceFactor,
      nicheAuthorityAtPublish: authorityAtPublish,
      seriesId:
        seriesVideos.length > 0
          ? `${draft.themeId}:${format.id}`
          : null,
      seriesFactor,
      complementaryFactor,
      libraryFactor,
      retentionRate,
      ctr,
      totalImpressions: 0,
      totalClicks: 0,
      totalViews: 0,
      totalWatchHours: 0,
      internalTrafficViews: 0,
      totalLikes: 0,
      totalSubscribers: 0,
      totalRevenue: 0,
      impressionRemainder: 0,
      clickRemainder: 0,
      viewRemainder: 0,
      watchRemainder: 0,
      internalTrafficRemainder: 0,
      likeRemainder: 0,
      subscriberRemainder: 0,
      revenueRemainder: 0
    };

    this.videos.unshift(video);
    this.nicheAuthority[draft.themeId] = this.clamp(
      this.nicheAuthority[draft.themeId] +
        0.8 +
        result.quality / 42 +
        Math.min(1.4, related.length * 0.08),
      0,
      100
    );
    this.host.onChange();
    return video;
  }

  public advance(hours: number, silent = false): ChannelGain {
    const safeHours = Math.max(0, Math.min(hours, MAX_OFFLINE_HOURS));
    const aggregate: ChannelGain = this.emptyGain();

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
        aggregate.impressions =
          (aggregate.impressions ?? 0) + (gain.impressions ?? 0);
        aggregate.clicks = (aggregate.clicks ?? 0) + (gain.clicks ?? 0);
        aggregate.views += gain.views;
        aggregate.watchHours =
          (aggregate.watchHours ?? 0) + (gain.watchHours ?? 0);
        aggregate.internalViews =
          (aggregate.internalViews ?? 0) + (gain.internalViews ?? 0);
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
      (aggregate.impressions ?? 0) > 0 ||
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
      lastSavedAt: Date.now(),
      nicheAuthority: { ...this.nicheAuthority }
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
    this.nicheAuthority = {
      ...this.createDefaultAuthority(),
      ...(save.nicheAuthority ?? {})
    };

    if (!save.nicheAuthority && this.videos.length > 0) {
      for (const video of this.videos) {
        this.nicheAuthority[video.themeId] = this.clamp(
          this.nicheAuthority[video.themeId] +
            0.7 +
            video.hiddenQuality / 55 +
            video.totalSubscribers * 0.03,
          0,
          100
        );
      }
    }

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
    const totals = this.getTotals();
    const ctr = totals.impressions > 0
      ? (totals.clicks / totals.impressions) * 100
      : 0;
    const subscriberConversion = totals.views > 0
      ? (totals.subscribers / totals.views) * 100
      : 0;
    const averageRetention = this.videos.length
      ? this.videos.reduce(
          (sum, video) => sum + Number(video.retentionRate ?? 0),
          0
        ) / this.videos.length
      : 0;
    const libraryEffect = this.getLibraryEffect();
    const internalRate = totals.views > 0
      ? (totals.internalViews / totals.views) * 100
      : 0;
    const seriesCount = new Set(
      this.videos
        .map((video) => video.seriesId)
        .filter((id): id is string => Boolean(id))
    ).size;

    return `
      <section class="channel-dashboard-hero">
        <div><span>CREATOR ANALYTICS</span><h3>Painel completo do canal</h3><p>A plataforma testa cada vídeo com impressões. Título e thumbnail geram cliques; retenção gera tempo assistido; confiança e identidade convertem inscritos.</p></div>
        <div><span>CATÁLOGO</span><strong>${this.videos.length} vídeos</strong><small>Efeito biblioteca +${Math.round((libraryEffect - 1) * 100)}%</small></div>
      </section>
      ${this.videos.length === 0 ? this.renderEmptyDashboard() : `
      <section class="channel-funnel">
        ${this.renderFunnelCard("Impressões", totals.impressions, "Quantas vezes a plataforma mostrou seus vídeos.", this.getImpressionAdvice())}
        ${this.renderFunnelCard("Cliques", totals.clicks, `CTR médio ${ctr.toFixed(1)}%`, this.getCtrAdvice(ctr))}
        ${this.renderFunnelCard("Views", totals.views, `${totals.internalViews.toLocaleString("pt-BR")} vindas do próprio canal`, this.getViewAdvice())}
        ${this.renderFunnelCard("Tempo assistido", Number(totals.watchHours.toFixed(1)), `Retenção média ${Math.round(averageRetention * 100)}%`, this.getRetentionAdvice(averageRetention))}
        ${this.renderFunnelCard("Inscritos", totals.subscribers, `Conversão ${subscriberConversion.toFixed(2)}%`, this.getSubscriberAdvice(subscriberConversion))}
      </section>
      <section class="channel-engine-grid">
        <article><span>TRÁFEGO INTERNO</span><strong>${internalRate.toFixed(1)}%</strong><p>Vídeos relacionados levam espectadores para outros conteúdos do catálogo.</p></article>
        <article><span>SÉRIES ATIVAS</span><strong>${seriesCount}</strong><p>Repetir nicho e formato cria continuidade e aumenta sessões com vários vídeos.</p></article>
        <article><span>EFEITO BIBLIOTECA</span><strong>+${Math.round((libraryEffect - 1) * 100)}%</strong><p>Um catálogo maior e consistente melhora descoberta, recomendações e cauda longa.</p></article>
        <article><span>RECEITA</span><strong>R$ ${totals.revenue.toFixed(2)}</strong><p>A receita começa após 1.000 inscritos e varia conforme o formato.</p></article>
      </section>
      <section class="niche-dashboard">
        <div class="channel-section-heading"><div><span>SISTEMA DE NICHOS</span><h3>Autoridade por assunto</h3></div><small>Publicar bons vídeos no mesmo nicho aumenta confiança e impressões futuras.</small></div>
        <div class="niche-authority-grid">${THEME_IDS.map((themeId) => this.renderNicheCard(themeId)).join("")}</div>
      </section>
      <section class="channel-improvement-guide">
        <div class="channel-section-heading"><div><span>COMO MELHORAR</span><h3>Leitura dos indicadores</h3></div></div>
        <div>${this.renderImprovementCards()}</div>
      </section>
      <section class="channel-video-catalog">
        <div class="channel-section-heading"><div><span>DESEMPENHO POR VÍDEO</span><h3>Catálogo e conexões</h3></div><small>Vídeos de busca e séries podem continuar crescendo por muito tempo.</small></div>
        <div class="video-library-list">${this.videos.map((video) => this.renderVideoCard(video)).join("")}</div>
      </section>`}
    `;
  }

  private processVideo(
    video: PublishedVideo,
    hours: number,
    currentConsistency: number
  ): ChannelGain {
    const midpointAge = video.ageHours + hours / 2;
    const freshness = Math.exp(-midpointAge / 64) * 0.82;
    const discovery = Math.exp(-midpointAge / 1100) * 0.16;
    const longTail =
      video.evergreenFactor *
      (0.022 + 0.09 / Math.sqrt(midpointAge / 24 + 1));
    const launchTest = midpointAge < 24 ? 0.72 : midpointAge < 72 ? 0.28 : 0;
    const rediscovery =
      Math.sin((midpointAge + this.channelHours) / 43) > 0.98 ? 1.42 : 1;
    const qualityPower = 0.58 + (video.hiddenQuality / 100) * 1.35;
    const channelPower =
      0.72 + Math.log10(video.subscribersAtPublish + 10) * 0.25;
    const authority = this.nicheAuthority[video.themeId];
    const authorityPower = 0.85 + authority / 95;
    const noise = 0.82 + Math.random() * 0.36;
    const consistencyBlend =
      (video.cadenceFactor ?? 0.82) * 0.56 + currentConsistency * 0.44;
    const related = this.videos.filter(
      (item) => item.id !== video.id && item.themeId === video.themeId
    );
    const seriesRelated = related.filter(
      (item) => item.formatId === video.formatId
    ).length;
    const complementaryRelated = related.length - seriesRelated;
    const seriesFactor = 1 + Math.min(0.34, seriesRelated * 0.055);
    const complementaryFactor =
      1 + Math.min(0.24, complementaryRelated * 0.035);
    const libraryFactor = this.getLibraryEffect();
    video.seriesFactor = seriesFactor;
    video.complementaryFactor = complementaryFactor;
    video.libraryFactor = libraryFactor;

    const rawImpressions =
      (14 +
        video.hiddenQuality * 0.52 +
        video.hiddenPlanningScore * 0.22 +
        authority * 0.38) *
      channelPower *
      video.initialMomentum *
      video.trendFactor *
      video.viralFactor *
      consistencyBlend *
      seriesFactor *
      complementaryFactor *
      libraryFactor *
      (freshness + discovery + longTail + launchTest) *
      rediscovery *
      noise *
      hours;

    video.impressionRemainder =
      Number(video.impressionRemainder ?? 0) + Math.max(0, rawImpressions);
    const impressions = Math.floor(video.impressionRemainder);
    video.impressionRemainder -= impressions;

    const ctr = this.clamp(
      Number(video.ctr ?? 0.05) *
        (0.92 + authority / 550) *
        (0.95 + currentConsistency * 0.06),
      0.018,
      0.18
    );
    video.ctr = ctr;
    video.clickRemainder =
      Number(video.clickRemainder ?? 0) + impressions * ctr;
    const clicks = Math.floor(video.clickRemainder);
    video.clickRemainder -= clicks;

    const internalRate = this.clamp(
      related.length * 0.025 +
        seriesRelated * 0.025 +
        complementaryRelated * 0.012 +
        (libraryFactor - 1) * 0.26,
      0,
      0.38
    );
    video.internalTrafficRemainder =
      Number(video.internalTrafficRemainder ?? 0) +
      clicks * internalRate +
      related.length * 0.035 * hours;
    const internalViews = Math.floor(video.internalTrafficRemainder);
    video.internalTrafficRemainder -= internalViews;

    video.viewRemainder += clicks + internalViews;
    const views = Math.floor(video.viewRemainder);
    video.viewRemainder -= views;

    const retention = this.clamp(
      Number(video.retentionRate ?? 0.4) *
        (0.96 + authority / 800) *
        (1 + Math.min(0.08, seriesRelated * 0.012)),
      0.2,
      0.82
    );
    video.retentionRate = retention;
    const minutesPerView = this.getFormatMinutes(video.formatId) * retention;
    video.watchRemainder =
      Number(video.watchRemainder ?? 0) + (views * minutesPerView) / 60;
    const watchHours = Math.floor(video.watchRemainder * 100) / 100;
    video.watchRemainder -= watchHours;

    const likeRate =
      0.018 +
      video.hiddenQuality * 0.00032 +
      video.hiddenEditingScore * 0.000075 +
      retention * 0.018;
    const subscriberRate = this.clamp(
      0.0028 +
        video.hiddenQuality * 0.000032 +
        video.hiddenPlanningScore * 0.000012 +
        retention * 0.006 +
        authority * 0.000035 +
        seriesRelated * 0.00022,
      0.0035,
      0.035
    );

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

    video.totalImpressions = Number(video.totalImpressions ?? 0) + impressions;
    video.totalClicks = Number(video.totalClicks ?? 0) + clicks;
    video.totalViews += views;
    video.totalWatchHours =
      Number(video.totalWatchHours ?? 0) + watchHours;
    video.internalTrafficViews =
      Number(video.internalTrafficViews ?? 0) + internalViews;
    video.totalLikes += likes;
    video.totalSubscribers += subscribers;
    video.totalRevenue += revenue;
    video.ageHours += hours;

    if (views > 0 || subscribers > 0) {
      this.nicheAuthority[video.themeId] = this.clamp(
        this.nicheAuthority[video.themeId] +
          Math.min(0.09, views / 4500 + subscribers * 0.012),
        0,
        100
      );
    }

    return {
      impressions,
      clicks,
      views,
      watchHours,
      internalViews,
      likes,
      subscribers,
      revenue,
      sourceVideoId: video.id,
      sourceTitle: video.title
    };
  }

  private calculateCadenceFactor(day: number, hour: number): number {
    if (this.videos.length === 0) return 0.82;

    const now = day * 24 + hour;
    const recent = this.videos.filter(
      (video) =>
        now - (video.publishedDay * 24 + video.publishedHour) <= 14 * 24
    );
    const latest = this.videos[0];
    const gapDays =
      (now - (latest.publishedDay * 24 + latest.publishedHour)) / 24;

    if (recent.length > 8) return 0.88;
    if (recent.length >= 3 && recent.length <= 7 && gapDays <= 5) return 1.14;
    if (recent.length >= 2 && gapDays <= 8) return 1.02;
    if (gapDays > 21) return 0.66;
    if (gapDays > 12) return 0.78;
    return 0.92;
  }

  private getCurrentConsistency(): number {
    if (this.videos.length === 0) return 0.72;

    const newestAgeDays = this.videos[0].ageHours / 24;
    const recentCount = this.videos.filter(
      (video) => video.ageHours <= 14 * 24
    ).length;

    if (recentCount >= 3 && recentCount <= 7 && newestAgeDays <= 5) return 1.08;
    if (recentCount >= 2 && newestAgeDays <= 8) return 0.98;
    if (recentCount > 8) return 0.86;
    if (newestAgeDays > 21) return 0.62;
    if (newestAgeDays > 12) return 0.75;
    return 0.9;
  }

  private getLibraryEffect(): number {
    if (this.videos.length === 0) return 1;
    const averageQuality =
      this.videos.reduce((sum, video) => sum + video.hiddenQuality, 0) /
      this.videos.length;
    return 1 + Math.min(
      0.58,
      Math.log1p(this.videos.length) * 0.085 + averageQuality / 650
    );
  }

  private calculateCtr(result: VideoResult, thumbnailBonus: number): number {
    return this.clamp(
      0.018 +
        result.titleScore * 0.00052 +
        Math.max(0, thumbnailBonus) * 0.0014 +
        result.quality * 0.00012,
      0.025,
      0.145
    );
  }

  private calculateRetentionRate(
    result: VideoResult,
    formatId: PublishedVideo["formatId"]
  ): number {
    const formatAdjustment =
      formatId === "short"
        ? 0.11
        : formatId === "documentary"
          ? -0.035
          : formatId === "review"
            ? 0.01
            : 0;
    return this.clamp(
      0.2 +
        result.editingScore * 0.0032 +
        result.planningScore * 0.0015 +
        result.quality * 0.0015 +
        formatAdjustment,
      0.24,
      0.78
    );
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

  private getFormatMinutes(formatId: PublishedVideo["formatId"]): number {
    switch (formatId) {
      case "short":
        return 0.75;
      case "review":
        return 11;
      case "documentary":
        return 19;
      default:
        return 8;
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

  private getTotals(): {
    impressions: number;
    clicks: number;
    views: number;
    watchHours: number;
    internalViews: number;
    likes: number;
    subscribers: number;
    revenue: number;
  } {
    return this.videos.reduce(
      (totals, video) => ({
        impressions: totals.impressions + Number(video.totalImpressions ?? 0),
        clicks: totals.clicks + Number(video.totalClicks ?? 0),
        views: totals.views + video.totalViews,
        watchHours: totals.watchHours + Number(video.totalWatchHours ?? 0),
        internalViews:
          totals.internalViews + Number(video.internalTrafficViews ?? 0),
        likes: totals.likes + video.totalLikes,
        subscribers: totals.subscribers + video.totalSubscribers,
        revenue: totals.revenue + video.totalRevenue
      }),
      {
        impressions: 0,
        clicks: 0,
        views: 0,
        watchHours: 0,
        internalViews: 0,
        likes: 0,
        subscribers: 0,
        revenue: 0
      }
    );
  }

  private renderFunnelCard(
    label: string,
    value: number,
    context: string,
    advice: string
  ): string {
    const formatted =
      label === "Tempo assistido"
        ? `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`
        : Number(value).toLocaleString("pt-BR");
    return `<article><span>${label}</span><strong>${formatted}</strong><small>${context}</small><p>${advice}</p></article>`;
  }

  private renderNicheCard(themeId: ThemeId): string {
    const authority = this.nicheAuthority[themeId];
    const videos = this.videos.filter((video) => video.themeId === themeId);
    const views = videos.reduce((sum, video) => sum + video.totalViews, 0);
    const level =
      authority >= 70
        ? "Referência"
        : authority >= 40
          ? "Especialista"
          : authority >= 18
            ? "Reconhecido"
            : authority > 0
              ? "Iniciante"
              : "Não explorado";
    return `
      <article class="niche-authority-card">
        <div><span>${THEME_LABELS[themeId]}</span><strong>${authority.toFixed(0)}/100</strong></div>
        <div class="niche-authority-track"><i style="width:${authority}%"></i></div>
        <p>${level} · ${videos.length} vídeos · ${views.toLocaleString("pt-BR")} views</p>
      </article>`;
  }

  private renderImprovementCards(): string {
    return `
      <article><span>IMPRESSÕES</span><strong>Publique com frequência no mesmo nicho</strong><p>Autoridade, tendência, consistência, catálogo e qualidade fazem a plataforma testar mais seus vídeos.</p></article>
      <article><span>CLIQUES</span><strong>Melhore título e thumbnail</strong><p>Design, promessa clara e compatibilidade entre título e conteúdo elevam o CTR.</p></article>
      <article><span>VIEWS</span><strong>Conecte vídeos relacionados</strong><p>Séries, vídeos complementares e catálogo forte transformam um clique em várias visualizações.</p></article>
      <article><span>TEMPO ASSISTIDO</span><strong>Fortaleça roteiro e edição</strong><p>Gancho, progressão, ritmo e recompensa mantêm o público assistindo por mais tempo.</p></article>
      <article><span>INSCRITOS</span><strong>Crie identidade e confiança</strong><p>Boa retenção, comunicação, autoridade de nicho e séries aumentam a conversão em seguidores.</p></article>
    `;
  }

  private renderVideoCard(video: PublishedVideo): string {
    const theme = THEMES.find((item) => item.id === video.themeId);
    const format = FORMATS.find((item) => item.id === video.formatId);
    const impressions = Number(video.totalImpressions ?? 0);
    const clicks = Number(video.totalClicks ?? 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const tags = [
      video.seriesFactor && video.seriesFactor > 1.02 ? "Série" : null,
      video.complementaryFactor && video.complementaryFactor > 1.02
        ? "Complementar"
        : null,
      Number(video.internalTrafficViews ?? 0) > 0 ? "Tráfego interno" : null,
      video.evergreenFactor >= 1.2 ? "Busca contínua" : null
    ].filter((tag): tag is string => Boolean(tag));

    return `
      <article class="video-library-card channel-video-card">
        <div class="video-library-card__preview"><span>${format?.label ?? "Vídeo"}</span><strong>${theme?.label ?? "Conteúdo"}</strong></div>
        <div class="video-library-card__content">
          <div class="video-library-card__title"><div><span>${this.getAgeLabel(video.ageHours)}</span><h4>${this.escapeHtml(video.title)}</h4></div><small class="video-activity-tag">${this.getActivityLabel(video)}</small></div>
          <div class="channel-video-tags">${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
          <div class="video-library-card__metrics channel-video-metrics">
            <div><span>Impressões</span><strong>${impressions.toLocaleString("pt-BR")}</strong></div>
            <div><span>CTR</span><strong>${ctr.toFixed(1)}%</strong></div>
            <div><span>Views</span><strong>${video.totalViews.toLocaleString("pt-BR")}</strong></div>
            <div><span>Tempo</span><strong>${Number(video.totalWatchHours ?? 0).toFixed(1)}h</strong></div>
            <div><span>Inscritos</span><strong>+${video.totalSubscribers.toLocaleString("pt-BR")}</strong></div>
            <div><span>Internas</span><strong>${Number(video.internalTrafficViews ?? 0).toLocaleString("pt-BR")}</strong></div>
          </div>
        </div>
      </article>`;
  }

  private renderEmptyDashboard(): string {
    return `
      <div class="channel-dashboard-empty"><strong>Nenhum vídeo publicado</strong><p>Publique o primeiro conteúdo para iniciar o teste de impressões e construir autoridade em um nicho.</p><div>${THEME_IDS.map((theme) => `<span>${THEME_LABELS[theme]}</span>`).join("")}</div></div>
    `;
  }

  private getImpressionAdvice(): string {
    const strongest = [...THEME_IDS].sort(
      (a, b) => this.nicheAuthority[b] - this.nicheAuthority[a]
    )[0];
    return this.videos.length < 3
      ? "O canal ainda possui pouco catálogo. Publique pelo menos três vídeos relacionados."
      : `Seu nicho mais forte é ${THEME_LABELS[strongest]}. Continuar nele aumenta autoridade.`;
  }

  private getCtrAdvice(ctr: number): string {
    if (ctr < 3.5) return "CTR baixo: priorize design, título e promessa mais clara.";
    if (ctr < 6) return "CTR mediano: teste títulos mais específicos e thumbnails legíveis.";
    return "CTR saudável: mantenha a identidade visual e evite promessas enganosas.";
  }

  private getViewAdvice(): string {
    return this.videos.length < 5
      ? "Mais vídeos relacionados aumentam o tráfego interno e a descoberta."
      : "Use o mesmo nicho em formatos diferentes para criar conteúdos complementares.";
  }

  private getRetentionAdvice(retention: number): string {
    if (retention < 0.35) return "Retenção baixa: melhore gancho, ritmo e clareza do roteiro.";
    if (retention < 0.52) return "Retenção razoável: reduza trechos lentos e antecipe recompensas.";
    return "Boa retenção: séries e vídeos longos podem aproveitar melhor esse público.";
  }

  private getSubscriberAdvice(conversion: number): string {
    if (conversion < 0.5) return "Conversão baixa: fortaleça identidade, comunicação e continuidade.";
    if (conversion < 1.2) return "Conversão saudável para um canal em crescimento.";
    return "Conversão forte: o público entende o valor e quer acompanhar o canal.";
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
    const normalized: PublishedVideo = {
      ...video,
      editingOrder: Array.isArray(video.editingOrder)
        ? [...video.editingOrder]
        : [],
      cadenceFactor: Number(video.cadenceFactor ?? 0.82),
      nicheAuthorityAtPublish: Number(video.nicheAuthorityAtPublish ?? 0),
      seriesId: video.seriesId ?? null,
      seriesFactor: Number(video.seriesFactor ?? 1),
      complementaryFactor: Number(video.complementaryFactor ?? 1),
      libraryFactor: Number(video.libraryFactor ?? 1),
      retentionRate: Number(
        video.retentionRate ??
          this.clamp(
            0.2 +
              video.hiddenEditingScore * 0.0032 +
              video.hiddenPlanningScore * 0.0015 +
              video.hiddenQuality * 0.0015,
            0.24,
            0.78
          )
      ),
      ctr: Number(
        video.ctr ??
          this.clamp(
            0.025 + video.hiddenTitleScore * 0.00055,
            0.025,
            0.13
          )
      ),
      ageHours: Number(video.ageHours ?? 0),
      totalImpressions: Number(
        video.totalImpressions ?? Math.round(video.totalViews * 18)
      ),
      totalClicks: Number(video.totalClicks ?? video.totalViews),
      totalViews: Number(video.totalViews ?? 0),
      totalWatchHours: Number(
        video.totalWatchHours ??
          (video.totalViews * this.getFormatMinutes(video.formatId) * 0.4) / 60
      ),
      internalTrafficViews: Number(video.internalTrafficViews ?? 0),
      totalLikes: Number(video.totalLikes ?? 0),
      totalSubscribers: Number(video.totalSubscribers ?? 0),
      totalRevenue: Number(video.totalRevenue ?? 0),
      impressionRemainder: Number(video.impressionRemainder ?? 0),
      clickRemainder: Number(video.clickRemainder ?? 0),
      viewRemainder: Number(video.viewRemainder ?? 0),
      watchRemainder: Number(video.watchRemainder ?? 0),
      internalTrafficRemainder: Number(video.internalTrafficRemainder ?? 0),
      likeRemainder: Number(video.likeRemainder ?? 0),
      subscriberRemainder: Number(video.subscriberRemainder ?? 0),
      revenueRemainder: Number(video.revenueRemainder ?? 0)
    };
    return normalized;
  }

  private createDefaultAuthority(): Record<ThemeId, number> {
    return {
      games: 0,
      technology: 0,
      vlog: 0,
      tutorial: 0,
      challenge: 0
    };
  }

  private emptyGain(): ChannelGain {
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
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

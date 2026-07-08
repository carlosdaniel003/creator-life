import { THEMES } from "../game/videoData";
import type { ChannelSimulationSave, ThemeOption } from "../game/types";
import { BalancedChannelSimulation } from "./BalancedChannelSimulation";

const EXTRA_THEME_IDS = ["react", "gossip", "music"] as const;
const EXTRA_THEME_LABELS: Record<(typeof EXTRA_THEME_IDS)[number], string> = {
  react: "React",
  gossip: "Fofocas e cultura pop",
  music: "Música e Rap"
};

const prototype = BalancedChannelSimulation.prototype as any;

if (!prototype.__expandedNichesPatched) {
  prototype.__expandedNichesPatched = true;

  const originalAddVideo = prototype.addVideo;
  const originalRestore = prototype.restore;
  const originalRenderLibraryHtml = prototype.renderLibraryHtml;
  const originalEvergreen = prototype.getEvergreenFactor;

  prototype.addVideo = function (...args: unknown[]) {
    ensureAuthority(this);
    return originalAddVideo.apply(this, args);
  };

  prototype.restore = function (
    save: Partial<ChannelSimulationSave> | null
  ) {
    const authority = Object.fromEntries(
      THEMES.map((theme) => [String(theme.id), 0])
    );
    const normalizedSave = save
      ? {
          ...save,
          nicheAuthority: {
            ...authority,
            ...(save.nicheAuthority ?? {})
          }
        }
      : save;

    const result = originalRestore.call(this, normalizedSave);
    ensureAuthority(this);
    return result;
  };

  prototype.getEvergreenFactor = function (
    themeId: string,
    formatId: string
  ): number {
    if (!EXTRA_THEME_IDS.includes(themeId as any)) {
      return originalEvergreen.call(this, themeId, formatId);
    }

    const themeFactor =
      themeId === "music" ? 1.08 : themeId === "react" ? 0.8 : 0.52;
    const formatFactor =
      formatId === "documentary"
        ? 1.3
        : formatId === "review"
          ? 1.2
          : formatId === "standard"
            ? 1
            : 0.52;
    return themeFactor * formatFactor;
  };

  prototype.renderLibraryHtml = function (): string {
    ensureAuthority(this);
    const base = originalRenderLibraryHtml.call(this) as string;
    const cards = EXTRA_THEME_IDS.map((themeId) => {
      const authority = Number(this.nicheAuthority?.[themeId] ?? 0);
      const videos = (this.videos ?? []).filter(
        (video: { themeId?: string }) => video.themeId === themeId
      );
      const views = videos.reduce(
        (sum: number, video: { totalViews?: number }) =>
          sum + Number(video.totalViews ?? 0),
        0
      );
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

      return `<article class="niche-authority-card"><div><span>${EXTRA_THEME_LABELS[themeId]}</span><strong>${authority.toFixed(0)}/100</strong></div><div class="niche-authority-track"><i style="width:${authority}%"></i></div><p>${level} · ${videos.length} vídeos · ${views.toLocaleString("pt-BR")} views</p></article>`;
    }).join("");

    return `${base}<section class="niche-dashboard niche-dashboard--expanded"><div class="channel-section-heading"><div><span>NOVOS NICHOS</span><h3>Entretenimento, cultura e música</h3></div><small>Esses assuntos também constroem autoridade própria e séries recorrentes.</small></div><div class="niche-authority-grid">${cards}</div></section>`;
  };
}

function ensureAuthority(simulation: any): void {
  if (!simulation.nicheAuthority) simulation.nicheAuthority = {};
  for (const theme of THEMES as ThemeOption[]) {
    const id = String(theme.id);
    if (!Number.isFinite(simulation.nicheAuthority[id])) {
      simulation.nicheAuthority[id] = 0;
    }
  }
}

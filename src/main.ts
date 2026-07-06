import type {
  ChannelGain,
  CreatorLifeSave,
  FormatOption,
  PlayerState,
  VideoDraft,
  VideoResult
} from "./game/types";
import { ChannelSimulation } from "./game3d/ChannelSimulation";
import { CreatorLife3D } from "./game3d/CreatorLife3D";
import { VideoProductionFlowV2 } from "./game3d/VideoProductionFlowV2";
import "./styles.css";
import "./production.css";
import "./production-v2.css";
import "./channel.css";

interface ModalAction {
  label: string;
  action: () => void;
  secondary?: boolean;
}

interface CreatorLifeRuntime {
  state: PlayerState;
  modalOpen: boolean;
  keys: Set<string>;
  openComputer: () => void;
  showModal: (
    title: string,
    body: string,
    actions: ModalAction[]
  ) => void;
  closeModal: () => void;
  showToast: (
    message: string,
    type: "success" | "warning" | "neutral"
  ) => void;
  advanceTime: (hours: number) => void;
  renderHud: () => void;
}

const SAVE_KEY = "creator-life-save-v2";
const LEGACY_SAVE_KEY = "creator-life-save-v1";
const container = document.getElementById("game-container");

if (!container) {
  throw new Error("O contêiner principal do jogo não foi encontrado.");
}

const game = new CreatorLife3D(container);
const runtime = game as unknown as CreatorLifeRuntime;
const baseAdvanceTime = runtime.advanceTime.bind(runtime);
const gainLayer = document.createElement("div");
gainLayer.className = "channel-gain-layer";
gainLayer.setAttribute("aria-live", "polite");
container.append(gainLayer);

let lastSubscriberCount = runtime.state.subscribers;
let saveTimer: number | null = null;

const scheduleSave = (): void => {
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveGame();
  }, 650);
};

const channelSimulation = new ChannelSimulation({
  getState: () => runtime.state,
  onGain: (gain) => animateChannelGain(gain),
  onChange: () => {
    runtime.renderHud();
    scheduleSave();
  }
});

const saveGame = (): void => {
  try {
    const payload: CreatorLifeSave = {
      version: 2,
      state: { ...runtime.state },
      channel: channelSimulation.serialize()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // O jogo continua funcionando quando o armazenamento é bloqueado.
  }
};

const applyState = (savedState: Partial<PlayerState>): void => {
  const fields: Array<keyof PlayerState> = [
    "day",
    "hour",
    "energy",
    "hunger",
    "creativity",
    "money",
    "subscribers",
    "totalViews",
    "videos"
  ];

  fields.forEach((field) => {
    const value = savedState[field];
    if (Number.isFinite(value)) {
      runtime.state[field] = Number(value) as never;
    }
  });
};

const loadGame = (): ChannelGain | null => {
  try {
    const currentSave = localStorage.getItem(SAVE_KEY);

    if (currentSave) {
      const payload = JSON.parse(currentSave) as CreatorLifeSave;
      applyState(payload.state ?? {});
      const offlineGain = channelSimulation.restore(payload.channel ?? null);
      runtime.renderHud();
      return offlineGain;
    }

    const legacySave = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacySave) {
      applyState(JSON.parse(legacySave) as Partial<PlayerState>);
      runtime.renderHud();
      saveGame();
    }
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }

  return null;
};

runtime.advanceTime = (hours: number) => {
  baseAdvanceTime(hours);
  channelSimulation.advance(hours);
  runtime.renderHud();
  scheduleSave();
};

const productionFlow = new VideoProductionFlowV2(container, {
  getState: () => runtime.state,
  onOpenChange: (open) => {
    runtime.modalOpen = open;
    runtime.keys.clear();
  },
  onProductionStart: (format: FormatOption) => {
    if (runtime.state.energy < format.energyCost) {
      return `Este formato exige ${format.energyCost} de energia.`;
    }
    if (runtime.state.creativity < format.creativityCost) {
      return `Este formato exige ${format.creativityCost} de criatividade.`;
    }

    runtime.state.energy = Math.max(
      0,
      runtime.state.energy - format.energyCost
    );
    runtime.state.creativity = Math.max(
      0,
      runtime.state.creativity - format.creativityCost
    );
    runtime.renderHud();
    scheduleSave();
    return null;
  },
  onStageTime: (hours) => runtime.advanceTime(hours),
  onPublished: (
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ) => {
    runtime.state.videos += 1;
    channelSimulation.addVideo(result, format, draft);
    runtime.renderHud();
    saveGame();
  }
});

const openVideoLibrary = (): void => {
  runtime.showModal(
    "Biblioteca do canal",
    channelSimulation.renderLibraryHtml(),
    [
      {
        label: "Atualizar dados",
        action: () => {
          runtime.closeModal();
          openVideoLibrary();
        }
      },
      {
        label: "Fechar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
};

runtime.openComputer = () => {
  runtime.showModal(
    "Estação de produção",
    `<div class="modal-stat-grid">
      <div><span>Vídeos publicados</span><strong>${runtime.state.videos}</strong></div>
      <div><span>Total de views</span><strong>${runtime.state.totalViews.toLocaleString("pt-BR")}</strong></div>
    </div>
    <p>Planeje, grave, edite, renderize e envie o próximo vídeo. O resultado não será revelado antes da publicação.</p>
    <p class="modal-note">Cada vídeo permanece no catálogo e pode continuar recebendo views, likes e inscritos por muito tempo.</p>`,
    [
      {
        label: "Criar novo vídeo",
        action: () => {
          runtime.closeModal();
          const error = productionFlow.open();
          if (error) runtime.showToast(error, "warning");
        }
      },
      {
        label: "Ver vídeos publicados",
        action: () => {
          runtime.closeModal();
          openVideoLibrary();
        }
      },
      {
        label: "Fechar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
};

function animateChannelGain(gain: ChannelGain): void {
  runtime.renderHud();

  const entries = [
    gain.views > 0 ? `+${gain.views.toLocaleString("pt-BR")} views` : null,
    gain.likes > 0 ? `+${gain.likes.toLocaleString("pt-BR")} likes` : null,
    gain.subscribers > 0
      ? `+${gain.subscribers.toLocaleString("pt-BR")} inscritos`
      : null,
    gain.revenue >= 0.01 ? `+R$ ${gain.revenue.toFixed(2)}` : null
  ].filter((item): item is string => item !== null);

  if (entries.length === 0) return;

  const notification = document.createElement("article");
  notification.className = "channel-gain-card";
  notification.innerHTML = `
    <span class="channel-gain-card__pulse"></span>
    <div><small>${escapeHtml(gain.sourceTitle)}</small><strong>${entries.join(" · ")}</strong></div>
  `;
  gainLayer.append(notification);

  const viewsElement = document.getElementById("hud-views");
  const subscribersElement = document.getElementById("hud-subscribers");
  if (gain.views > 0) pulseElement(viewsElement);
  if (gain.subscribers > 0) pulseElement(subscribersElement);

  window.setTimeout(() => notification.classList.add("is-visible"), 20);
  window.setTimeout(() => {
    notification.classList.remove("is-visible");
    window.setTimeout(() => notification.remove(), 280);
  }, 3600);

  const previousSubscribers = lastSubscriberCount;
  lastSubscriberCount = runtime.state.subscribers;

  if (previousSubscribers < 1000 && lastSubscriberCount >= 1000) {
    runtime.showToast("Canal monetizado: 1.000 inscritos alcançados.", "success");
  } else if (previousSubscribers < 100 && lastSubscriberCount >= 100) {
    runtime.showToast("Primeira meta concluída: 100 inscritos.", "success");
  }
}

function pulseElement(element: HTMLElement | null): void {
  if (!element) return;
  element.classList.remove("is-channel-updating");
  void element.offsetWidth;
  element.classList.add("is-channel-updating");
  window.setTimeout(() => element.classList.remove("is-channel-updating"), 620);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && productionFlow.handleEscape()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

window.addEventListener("beforeunload", saveGame);
window.setInterval(saveGame, 5000);

const offlineGain = loadGame();
lastSubscriberCount = runtime.state.subscribers;
channelSimulation.start();

if (
  offlineGain &&
  (offlineGain.views > 0 || offlineGain.subscribers > 0)
) {
  window.setTimeout(() => {
    animateChannelGain({
      ...offlineGain,
      sourceTitle: "Desempenho enquanto você estava fora"
    });
  }, 800);
}

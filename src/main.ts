import type {
  FormatOption,
  PlayerState,
  VideoDraft,
  VideoResult
} from "./game/types";
import { CreatorLife3D } from "./game3d/CreatorLife3D";
import { VideoProductionFlow } from "./game3d/VideoProductionFlow";
import "./styles.css";
import "./production.css";

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

const SAVE_KEY = "creator-life-save-v1";
const container = document.getElementById("game-container");

if (!container) {
  throw new Error("O contêiner principal do jogo não foi encontrado.");
}

const game = new CreatorLife3D(container);
const runtime = game as unknown as CreatorLifeRuntime;
let pendingPublicationMessage: string | null = null;

const saveGame = (): void => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(runtime.state));
  } catch {
    // O jogo continua funcionando mesmo quando o armazenamento é bloqueado.
  }
};

const loadGame = (): void => {
  try {
    const serializedState = localStorage.getItem(SAVE_KEY);

    if (!serializedState) {
      return;
    }

    const savedState = JSON.parse(serializedState) as Partial<PlayerState>;

    Object.assign(runtime.state, {
      day: Number.isFinite(savedState.day) ? savedState.day : runtime.state.day,
      hour: Number.isFinite(savedState.hour)
        ? savedState.hour
        : runtime.state.hour,
      energy: Number.isFinite(savedState.energy)
        ? savedState.energy
        : runtime.state.energy,
      hunger: Number.isFinite(savedState.hunger)
        ? savedState.hunger
        : runtime.state.hunger,
      creativity: Number.isFinite(savedState.creativity)
        ? savedState.creativity
        : runtime.state.creativity,
      money: Number.isFinite(savedState.money)
        ? savedState.money
        : runtime.state.money,
      subscribers: Number.isFinite(savedState.subscribers)
        ? savedState.subscribers
        : runtime.state.subscribers,
      totalViews: Number.isFinite(savedState.totalViews)
        ? savedState.totalViews
        : runtime.state.totalViews,
      videos: Number.isFinite(savedState.videos)
        ? savedState.videos
        : runtime.state.videos
    });

    runtime.renderHud();
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
};

const productionFlow = new VideoProductionFlow(container, {
  getState: () => runtime.state,
  onOpenChange: (open) => {
    runtime.modalOpen = open;
    runtime.keys.clear();

    if (!open && pendingPublicationMessage) {
      runtime.showToast(pendingPublicationMessage, "success");
      pendingPublicationMessage = null;
    }
  },
  onPublish: (
    result: VideoResult,
    format: FormatOption,
    _draft: VideoDraft
  ) => {
    const subscribersBeforePublishing = runtime.state.subscribers;

    runtime.state.energy = Math.max(
      0,
      runtime.state.energy - format.energyCost
    );
    runtime.state.creativity = Math.max(
      0,
      runtime.state.creativity - format.creativityCost
    );
    runtime.state.videos += 1;
    runtime.state.totalViews += result.views;
    runtime.state.subscribers += result.subscribers;
    runtime.state.money += result.revenue;
    runtime.advanceTime(format.hours);
    runtime.renderHud();
    saveGame();

    const reachedFirstMilestone =
      subscribersBeforePublishing < 100 && runtime.state.subscribers >= 100;
    const reachedMonetization =
      subscribersBeforePublishing < 1000 && runtime.state.subscribers >= 1000;

    pendingPublicationMessage = reachedMonetization
      ? "Canal monetizado: você ultrapassou 1.000 inscritos."
      : reachedFirstMilestone
        ? "Primeira meta concluída: 100 inscritos alcançados."
        : `Vídeo publicado: +${result.views.toLocaleString("pt-BR")} views e +${result.subscribers.toLocaleString("pt-BR")} inscritos.`;
  }
});

runtime.openComputer = () => {
  runtime.showModal(
    "Estação de produção",
    `<div class="modal-stat-grid">
      <div><span>Vídeos publicados</span><strong>${runtime.state.videos}</strong></div>
      <div><span>Total de views</span><strong>${runtime.state.totalViews.toLocaleString("pt-BR")}</strong></div>
    </div>
    <p>Planeje o tema, o formato, o título e a thumbnail. Depois organize os blocos na mesa de edição antes de publicar.</p>
    <p class="modal-note">Cada escolha altera qualidade, retenção, alcance, inscritos e receita do canal.</p>`,
    [
      {
        label: "Criar novo vídeo",
        action: () => {
          runtime.closeModal();
          const error = productionFlow.open();

          if (error) {
            runtime.showToast(error, "warning");
          }
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
loadGame();

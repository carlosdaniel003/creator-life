import type {
  ChannelGain,
  CreatorLifeSave,
  FormatOption,
  LifeSimulationSave,
  PlayerState,
  ProgressionSave,
  VideoDraft,
  VideoResult
} from "./game/types";
import { BalancedChannelSimulation } from "./game3d/BalancedChannelSimulation";
import { ComputerTaskController } from "./game3d/ComputerTaskController";
import { CreatorLife3D } from "./game3d/CreatorLife3D";
import { LifeSimulation } from "./game3d/LifeSimulation";
import { ProgressionSystem } from "./game3d/ProgressionSystem";
import { RoomProgressionVisuals } from "./game3d/RoomProgressionVisuals";
import { VideoProductionFlowV3 } from "./game3d/VideoProductionFlowV3";
import "./styles.css";
import "./production.css";
import "./production-v2.css";
import "./channel.css";
import "./computer-task.css";
import "./youtube-theme.css";
import "./life.css";
import "./progression.css";

interface ModalAction {
  label: string;
  action: () => void;
  secondary?: boolean;
}

interface CreatorLifeRuntime {
  state: PlayerState & { thirst: number };
  modalOpen: boolean;
  keys: Set<string>;
  openComputer: () => void;
  openFridge: () => void;
  openBed: () => void;
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

interface LegacySave {
  version?: number;
  state?: Partial<PlayerState>;
  channel?: CreatorLifeSave["channel"];
  life?: Partial<LifeSimulationSave>;
  progression?: Partial<ProgressionSave>;
}

const SAVE_KEY = "creator-life-save-v4";
const LEGACY_SAVE_KEYS = [
  "creator-life-save-v3",
  "creator-life-save-v2",
  "creator-life-save-v1"
];
const container = document.getElementById("game-container");

if (!container) {
  throw new Error("O contêiner principal do jogo não foi encontrado.");
}

const game = new CreatorLife3D(container);
const runtime = game as unknown as CreatorLifeRuntime;
const baseAdvanceTime = runtime.advanceTime.bind(runtime);
const baseRenderHud = runtime.renderHud.bind(runtime);
const roomVisuals = new RoomProgressionVisuals((game as any).scene);
const computerTask = new ComputerTaskController(game as any);

if (!Number.isFinite(runtime.state.thirst)) {
  runtime.state.thirst = 100;
}

const thirstHud = installThirstHud();
let lastSubscriberCount = runtime.state.subscribers;
let saveTimer: number | null = null;
let channelSimulation!: BalancedChannelSimulation;
let lifeSimulation!: LifeSimulation;
let progressionSystem!: ProgressionSystem;

const scheduleSave = (): void => {
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveGame();
  }, 650);
};

lifeSimulation = new LifeSimulation(container, {
  getState: () => runtime.state,
  onChange: () => {
    runtime.renderHud();
    scheduleSave();
  },
  onEvent: (message, type) => runtime.showToast(message, type)
});

progressionSystem = new ProgressionSystem({
  getState: () => runtime.state,
  getAcademicGrade: () => lifeSimulation.getCollegeGrade(),
  advanceTime: (hours) => runtime.advanceTime(hours),
  onChange: () => {
    runtime.renderHud();
    scheduleSave();
  },
  onEvent: (message, type) => runtime.showToast(message, type),
  applyVisuals: (save) => roomVisuals.apply(save)
});

channelSimulation = new BalancedChannelSimulation({
  getState: () => runtime.state,
  onGain: (gain) => animateChannelGain(gain),
  onChange: () => {
    runtime.renderHud();
    scheduleSave();
  }
});

runtime.renderHud = () => {
  baseRenderHud();
  thirstHud.value.textContent = `${Math.round(runtime.state.thirst)}/100`;
  thirstHud.bar.style.width = `${Math.max(
    0,
    Math.min(100, runtime.state.thirst)
  )}%`;
  lifeSimulation?.renderHud();
};

const saveGame = (): void => {
  try {
    const payload: CreatorLifeSave = {
      version: 4,
      state: { ...runtime.state },
      channel: channelSimulation.serialize(),
      life: lifeSimulation.serialize(),
      progression: progressionSystem.serialize()
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
    "thirst",
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

  if (!Number.isFinite(runtime.state.thirst)) {
    runtime.state.thirst = 100;
  }
};

const findLegacySave = (): LegacySave | null => {
  for (const key of LEGACY_SAVE_KEYS) {
    const serialized = localStorage.getItem(key);
    if (!serialized) continue;

    const parsed = JSON.parse(serialized) as LegacySave | Partial<PlayerState>;
    if ("state" in parsed) return parsed as LegacySave;
    return { state: parsed as Partial<PlayerState> };
  }

  return null;
};

const loadGame = (): ChannelGain | null => {
  try {
    const currentSave = localStorage.getItem(SAVE_KEY);
    const payload = currentSave
      ? (JSON.parse(currentSave) as CreatorLifeSave)
      : findLegacySave();

    if (!payload) {
      lifeSimulation.restore(null);
      progressionSystem.restore(null);
      runtime.renderHud();
      return null;
    }

    applyState(payload.state ?? {});
    lifeSimulation.restore(payload.life ?? null);
    progressionSystem.restore(payload.progression ?? null);
    const offlineGain = channelSimulation.restore(payload.channel ?? null);
    runtime.renderHud();
    saveGame();
    return offlineGain;
  } catch {
    localStorage.removeItem(SAVE_KEY);
    lifeSimulation.restore(null);
    progressionSystem.restore(null);
    runtime.renderHud();
    return null;
  }
};

runtime.advanceTime = (hours: number) => {
  baseAdvanceTime(hours);
  lifeSimulation.advance(hours);
  progressionSystem.advance(hours);
  channelSimulation.advance(hours);
  runtime.renderHud();
  scheduleSave();
};

const productionFlow = new VideoProductionFlowV3(container, {
  getState: () => runtime.state,
  getProgressionModifiers: () => progressionSystem.getModifiers(),
  onOpenChange: (open) => {
    runtime.modalOpen = open;
    runtime.keys.clear();
  },
  onProductionStart: (format: FormatOption) => {
    const modifiers = progressionSystem.getModifiers();
    const energyCost = Math.ceil(
      format.energyCost * modifiers.energyCostMultiplier
    );

    if (runtime.state.energy < energyCost) {
      return `Este formato exige ${energyCost} de energia com sua estrutura atual.`;
    }
    if (runtime.state.creativity < format.creativityCost) {
      return `Este formato exige ${format.creativityCost} de criatividade.`;
    }
    if (runtime.state.hunger < 18 || runtime.state.thirst < 18) {
      return "Coma e beba água antes de iniciar uma produção longa.";
    }

    const productionCostError = lifeSimulation.payProductionCost(format.id);
    if (productionCostError) return productionCostError;

    runtime.state.energy = Math.max(0, runtime.state.energy - energyCost);
    runtime.state.creativity = Math.max(
      0,
      runtime.state.creativity - format.creativityCost
    );
    runtime.renderHud();
    scheduleSave();
    return null;
  },
  onRunProduction: async (
    stages,
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ) => {
    await computerTask.runProduction(
      stages,
      (hours) => runtime.advanceTime(hours),
      () => {
        result.hiddenValueFallback = {
          editing: Math.max(0, result.editingScore / 18)
        };
        runtime.state.videos += 1;
        channelSimulation.addVideo(result, format, draft);
        const sponsorMessage = progressionSystem.recordVideoPublished(
          result,
          format,
          draft
        );
        runtime.renderHud();
        saveGame();

        if (sponsorMessage) {
          computerTask.showMilestone("Contrato", sponsorMessage);
        }
      }
    );
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

const openAgenda = (message = ""): void => {
  runtime.showModal(
    "Agenda pessoal",
    `${
      message
        ? `<p class="agenda-message">${escapeHtml(message)}</p>`
        : ""
    }${lifeSimulation.renderAgendaHtml()}`,
    [
      {
        label: "Fechar agenda",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );

  container
    .querySelectorAll<HTMLButtonElement>("[data-pay-bill]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const uid = button.dataset.payBill;
        if (!uid) return;
        const error = lifeSimulation.payBill(uid);
        runtime.closeModal();
        openAgenda(error ?? "Pagamento confirmado.");
      });
    });
};

const openProgressionHub = (message = ""): void => {
  runtime.showModal(
    "Evolução do criador",
    progressionSystem.renderHubHtml(message),
    [
      {
        label: "Fechar central",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );

  progressionSystem.bindHubEvents(container, (nextMessage) => {
    runtime.closeModal();
    openProgressionHub(nextMessage);
  });
};

const openStudy = (): void => {
  runtime.showModal(
    "Estudar para a faculdade",
    `<div class="study-modal-card">
      <span>OBRIGAÇÃO SEMANAL</span>
      <strong>Mantenha pelo menos 10 horas de estudo por semana</strong>
      <p>Sem estudo, a média cai. A cada quatro semanas há uma prova que pode aumentar o risco de reprovação.</p>
    </div>`,
    [
      {
        label: "Estudar 2 horas",
        action: () => performStudy(2)
      },
      {
        label: "Estudar 4 horas",
        action: () => performStudy(4)
      },
      {
        label: "Cancelar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
};

const performStudy = (hours: 2 | 4): void => {
  const error = lifeSimulation.study(hours);
  if (error) {
    runtime.showToast(error, "warning");
    return;
  }

  runtime.advanceTime(hours);
  runtime.closeModal();
  runtime.showToast(
    `Sessão concluída: ${hours} horas adicionadas à rotina acadêmica.`,
    "success"
  );
};

const openFreelance = (): void => {
  const multiplier = progressionSystem.getModifiers().freelanceIncomeMultiplier;
  runtime.showModal(
    "Trabalho freelance",
    `<div class="freelance-modal-card">
      <span>RENDA ALTERNATIVA</span>
      <strong>Entrega digital de 4 horas</strong>
      <p>O pagamento base fica entre R$ 50 e R$ 75. Seu equipamento, habilidades e reputação aplicam atualmente um multiplicador de ${multiplier.toFixed(2)}x.</p>
      <small>Exige internet ativa, 20 de energia e alimentação adequada.</small>
    </div>`,
    [
      {
        label: "Aceitar trabalho",
        action: () => {
          const result = lifeSimulation.completeFreelanceJob();
          if (result.error) {
            runtime.showToast(result.error, "warning");
            return;
          }

          const bonus = progressionSystem.recordFreelance(result.income);
          runtime.advanceTime(4);
          runtime.closeModal();
          computerTask.showMilestone(
            "Freelance concluído",
            `Pagamento total: R$ ${(result.income + bonus).toFixed(2)}.`
          );
        }
      },
      {
        label: "Cancelar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
};

runtime.openComputer = () => {
  const monetizationText =
    runtime.state.subscribers >= 1000
      ? "Canal monetizado"
      : `${runtime.state.subscribers.toLocaleString("pt-BR")} / 1.000 inscritos`;
  const modifiers = progressionSystem.getModifiers();

  runtime.showModal(
    "Seu computador",
    `<div class="modal-stat-grid">
      <div><span>Vídeos publicados</span><strong>${runtime.state.videos}</strong></div>
      <div><span>Monetização</span><strong>${monetizationText}</strong></div>
      <div><span>Teto técnico</span><strong>${Math.round(
        modifiers.qualityCeiling
      )}/100</strong></div>
      <div><span>Consistência</span><strong>${Math.round(
        modifiers.qualityConsistency * 100
      )}%</strong></div>
    </div>
    <p>Gerencie canal, trabalhos, faculdade, finanças, equipamentos, quarto e formação profissional.</p>
    <p class="modal-note">Equipamento aumenta o potencial. Habilidade, prática, rotina e boas decisões determinam quanto desse potencial será alcançado.</p>`,
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
        label: "Evolução e lojas",
        action: () => {
          runtime.closeModal();
          openProgressionHub();
        }
      },
      {
        label: "Trabalho freelance",
        action: () => {
          runtime.closeModal();
          openFreelance();
        }
      },
      {
        label: "Estudar faculdade",
        action: () => {
          runtime.closeModal();
          openStudy();
        }
      },
      {
        label: "Abrir agenda",
        action: () => {
          runtime.closeModal();
          openAgenda();
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

runtime.openFridge = () => {
  runtime.showModal(
    "Cozinha e hidratação",
    `<div class="food-options-grid">
      <article><span>REFEIÇÃO</span><strong>R$ 14,00</strong><p>Recupera 52 de fome e consome uma hora.</p></article>
      <article><span>ÁGUA</span><strong>R$ 3,00</strong><p>Recupera 44 de hidratação e consome uma hora.</p></article>
    </div>`,
    [
      {
        label: "Comprar refeição",
        action: () => {
          const error = lifeSimulation.buyMeal();
          if (error) {
            runtime.showToast(error, "warning");
            return;
          }
          runtime.advanceTime(1);
          runtime.closeModal();
          runtime.showToast("Refeição concluída. −R$ 14,00.", "success");
        }
      },
      {
        label: "Comprar água",
        action: () => {
          const error = lifeSimulation.buyWater();
          if (error) {
            runtime.showToast(error, "warning");
            return;
          }
          runtime.advanceTime(1);
          runtime.closeModal();
          runtime.showToast("Você se hidratou. −R$ 3,00.", "success");
        }
      },
      {
        label: "Cancelar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
};

runtime.openBed = () => {
  const modifiers = progressionSystem.getModifiers();
  const energyRecovery = Math.round(62 * modifiers.bedRecoveryMultiplier);
  const creativityRecovery = Math.round(
    18 * modifiers.creativityRecoveryMultiplier
  );

  runtime.showModal(
    "Descansar",
    `<div class="study-modal-card">
      <span>RECUPERAÇÃO</span>
      <strong>Seu quarto recupera ${energyRecovery} de energia</strong>
      <p>A cama e o conforto atual também recuperam ${creativityRecovery} de criatividade durante 7 horas de sono.</p>
    </div>`,
    [
      {
        label: "Dormir 7 horas",
        action: () => {
          runtime.state.energy = Math.min(
            100,
            runtime.state.energy + energyRecovery
          );
          runtime.state.creativity = Math.min(
            100,
            runtime.state.creativity + creativityRecovery
          );
          runtime.advanceTime(7);
          runtime.closeModal();
          runtime.showToast("Descanso concluído.", "success");
        }
      },
      {
        label: "Cancelar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
};

function animateChannelGain(gain: ChannelGain): void {
  runtime.renderHud();
  computerTask.showChannelGain(gain);

  if (gain.views > 0) pulseElement(document.getElementById("hud-views"));
  if (gain.subscribers > 0) {
    pulseElement(document.getElementById("hud-subscribers"));
  }

  const previousSubscribers = lastSubscriberCount;
  lastSubscriberCount = runtime.state.subscribers;

  if (previousSubscribers < 1000 && lastSubscriberCount >= 1000) {
    computerTask.showMilestone(
      "Canal monetizado",
      "Você ultrapassou 1.000 inscritos. Agora as views começam a gerar receita."
    );
  } else if (previousSubscribers < 100 && lastSubscriberCount >= 100) {
    computerTask.showMilestone(
      "Primeiros 100 inscritos",
      "A primeira etapa foi concluída, mas ainda há um longo caminho até a monetização."
    );
  }
}

function installThirstHud(): { value: HTMLElement; bar: HTMLElement } {
  const resourceCard = container.querySelector<HTMLElement>(".resource-card");
  if (!resourceCard) {
    throw new Error("Painel de recursos não encontrado.");
  }

  const row = document.createElement("div");
  row.className = "resource-row";
  row.innerHTML = `
    <div class="resource-row__label"><span>Hidratação</span><strong id="thirst-value">100/100</strong></div>
    <div class="resource-track"><div id="thirst-bar" class="resource-fill resource-fill--thirst"></div></div>
  `;
  resourceCard.append(row);

  const value = document.getElementById("thirst-value");
  const bar = document.getElementById("thirst-bar");
  if (!value || !bar) {
    throw new Error("Indicador de hidratação não encontrado.");
  }
  return { value, bar };
}

function pulseElement(element: HTMLElement | null): void {
  if (!element) return;
  element.classList.remove("is-channel-updating");
  void element.offsetWidth;
  element.classList.add("is-channel-updating");
  window.setTimeout(
    () => element.classList.remove("is-channel-updating"),
    620
  );
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
runtime.renderHud();

if (
  offlineGain &&
  (offlineGain.views > 0 || offlineGain.subscribers > 0)
) {
  window.setTimeout(() => {
    computerTask.showChannelGain({
      ...offlineGain,
      sourceTitle: "Enquanto você estava fora"
    });
  }, 800);
}

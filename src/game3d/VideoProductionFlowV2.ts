import { FORMATS, TITLE_IDEAS } from "../game/videoData";
import type {
  EditingBlockId,
  FormatOption,
  PlayerState,
  VideoDraft,
  VideoResult
} from "../game/types";
import {
  calculateHiddenVideoResult,
  createVideoDraft,
  getProductionStages,
  validateVideoDraft
} from "./VideoProductionModel";
import {
  renderEditorView,
  renderPlannerView,
  renderPublishedView,
  renderStageView
} from "./VideoProductionTemplates";

interface ProductionHost {
  getState: () => PlayerState;
  onOpenChange: (open: boolean) => void;
  onProductionStart: (
    format: FormatOption,
    draft: VideoDraft
  ) => string | null;
  onStageTime: (hours: number) => void;
  onPublished: (
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ) => void;
}

export class VideoProductionFlowV2 {
  private readonly overlay: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly host: ProductionHost;
  private draft: VideoDraft = createVideoDraft();
  private draggedBlockId: EditingBlockId | null = null;
  private opened = false;
  private processing = false;
  private runToken = 0;

  public constructor(container: HTMLElement, host: ProductionHost) {
    this.host = host;
    this.overlay = document.createElement("div");
    this.overlay.className = "production-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.innerHTML = '<section class="production-panel" role="dialog" aria-modal="true"></section>';
    container.append(this.overlay);

    const panel = this.overlay.querySelector<HTMLElement>(".production-panel");
    if (!panel) throw new Error("Painel de produção não encontrado.");
    this.panel = panel;

    this.panel.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (target?.closest(".production-close") && !this.processing) {
        this.close();
      }
    });

    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay && !this.processing) this.close();
    });
  }

  public open(): string | null {
    if (this.opened) return null;

    const state = this.host.getState();
    if (state.energy < 18) return "Você precisa de pelo menos 18 de energia.";
    if (state.hunger < 20) return "Você está com muita fome para produzir.";
    if (state.creativity < 11) return "Recupere criatividade antes de produzir.";

    this.opened = true;
    this.processing = false;
    this.draft = createVideoDraft();
    this.host.onOpenChange(true);
    this.overlay.classList.add("is-visible");
    this.overlay.setAttribute("aria-hidden", "false");
    this.renderPlanner();
    return null;
  }

  public close(): void {
    if (!this.opened || this.processing) return;
    this.opened = false;
    this.draggedBlockId = null;
    this.runToken += 1;
    this.overlay.classList.remove("is-visible");
    this.overlay.setAttribute("aria-hidden", "true");
    this.host.onOpenChange(false);
  }

  public handleEscape(): boolean {
    if (!this.opened) return false;
    if (!this.processing) this.close();
    return true;
  }

  private renderPlanner(errorMessage = ""): void {
    this.panel.innerHTML = renderPlannerView(
      this.draft,
      this.host.getState(),
      errorMessage
    );
    this.bindPlannerEvents();
  }

  private bindPlannerEvents(): void {
    this.panel.querySelectorAll<HTMLElement>("[data-theme-id]").forEach((card) => {
      card.addEventListener("click", () => {
        this.draft.themeId = card.dataset.themeId as VideoDraft["themeId"];
        this.renderPlanner();
      });
    });

    this.panel.querySelectorAll<HTMLElement>("[data-format-id]").forEach((card) => {
      card.addEventListener("click", () => {
        this.draft.formatId = card.dataset.formatId as VideoDraft["formatId"];
        this.renderPlanner();
      });
    });

    this.panel.querySelectorAll<HTMLElement>("[data-thumbnail-id]").forEach((card) => {
      card.addEventListener("click", () => {
        this.draft.thumbnailId = card.dataset.thumbnailId as VideoDraft["thumbnailId"];
        this.renderPlanner();
      });
    });

    const input = this.panel.querySelector<HTMLInputElement>("#video-title-input");
    const counter = this.panel.querySelector<HTMLElement>("#title-counter");
    input?.addEventListener("input", () => {
      this.draft.title = input.value;
      if (counter) counter.textContent = `${input.value.length}/58 caracteres`;
    });

    this.panel.querySelector("#generate-title")?.addEventListener("click", () => {
      if (!this.draft.themeId) {
        this.renderPlanner("Escolha um tema antes de gerar o título.");
        return;
      }
      const ideas = TITLE_IDEAS[this.draft.themeId];
      this.draft.title = ideas[Math.floor(Math.random() * ideas.length)] ?? "";
      this.renderPlanner();
    });

    this.panel.querySelector("#cancel-production")?.addEventListener("click", () => this.close());
    this.panel.querySelector("#continue-production")?.addEventListener("click", () => {
      const error = validateVideoDraft(this.draft, this.host.getState());
      if (error) this.renderPlanner(error);
      else this.renderEditor();
    });
  }

  private renderEditor(): void {
    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    if (!format) {
      this.renderPlanner("Formato inválido.");
      return;
    }

    this.panel.innerHTML = renderEditorView(this.draft, format);
    this.bindEditorEvents();
  }

  private bindEditorEvents(): void {
    this.panel.querySelector("#back-to-planner")?.addEventListener("click", () => this.renderPlanner());
    this.panel.querySelector("#start-production")?.addEventListener("click", () => void this.startProduction());

    this.panel.querySelectorAll<HTMLElement>("[data-block-id]").forEach((card) => {
      const blockId = card.dataset.blockId as EditingBlockId;

      card.addEventListener("dragstart", (event) => {
        this.draggedBlockId = blockId;
        card.classList.add("is-dragging");
        event.dataTransfer?.setData("text/plain", blockId);
      });
      card.addEventListener("dragend", () => {
        this.draggedBlockId = null;
        card.classList.remove("is-dragging");
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("is-drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        card.classList.remove("is-drop-target");
        const dragged = this.draggedBlockId ?? (event.dataTransfer?.getData("text/plain") as EditingBlockId);
        if (!dragged || dragged === blockId) return;
        this.moveBlockBefore(dragged, blockId);
        this.renderEditor();
      });

      card.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
        button.addEventListener("click", () => {
          this.moveBlockBy(blockId, Number(button.dataset.move));
          this.renderEditor();
        });
      });
    });
  }

  private async startProduction(): Promise<void> {
    if (this.processing) return;

    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    if (!format) return;

    const error = validateVideoDraft(this.draft, this.host.getState());
    if (error) {
      this.renderPlanner(error);
      return;
    }

    const startError = this.host.onProductionStart(format, this.cloneDraft());
    if (startError) {
      this.renderPlanner(startError);
      return;
    }

    this.processing = true;
    const token = ++this.runToken;
    const stages = getProductionStages(format);

    for (let index = 0; index < stages.length; index += 1) {
      if (token !== this.runToken) return;
      await this.animateStage(stages[index], index, stages, token);
      this.host.onStageTime(stages[index].hours);
    }

    if (token !== this.runToken) return;
    const result = calculateHiddenVideoResult(this.draft, this.host.getState());
    this.host.onPublished(result, format, this.cloneDraft());
    this.processing = false;
    this.panel.innerHTML = renderPublishedView(this.draft, format);
    this.panel.querySelector("#finish-production")?.addEventListener("click", () => this.close());
  }

  private animateStage(
    stage: ReturnType<typeof getProductionStages>[number],
    index: number,
    stages: ReturnType<typeof getProductionStages>,
    token: number
  ): Promise<void> {
    this.panel.innerHTML = renderStageView(stage, index, stages);

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const bar = this.panel.querySelector<HTMLElement>("#stage-progress-bar");
      const value = this.panel.querySelector<HTMLElement>("#stage-progress-value");
      const status = this.panel.querySelector<HTMLElement>("#processing-status");

      const update = (now: number): void => {
        if (token !== this.runToken) {
          resolve();
          return;
        }

        const progress = Math.min(1, (now - startedAt) / stage.durationMs);
        const percent = Math.round(progress * 100);
        if (bar) bar.style.width = `${percent}%`;
        if (value) value.textContent = `${percent}%`;
        if (status && stage.id === "upload") {
          const speed = 4.5 + Math.sin(now / 380) * 1.4 + progress * 2.1;
          status.textContent = `Upload ${speed.toFixed(1)} MB/s`;
        }

        if (progress < 1) requestAnimationFrame(update);
        else window.setTimeout(resolve, 180);
      };

      requestAnimationFrame(update);
    });
  }

  private moveBlockBefore(draggedId: EditingBlockId, targetId: EditingBlockId): void {
    const nextOrder = this.draft.editingOrder.filter((id) => id !== draggedId);
    nextOrder.splice(nextOrder.indexOf(targetId), 0, draggedId);
    this.draft.editingOrder = nextOrder;
  }

  private moveBlockBy(blockId: EditingBlockId, direction: number): void {
    const currentIndex = this.draft.editingOrder.indexOf(blockId);
    const nextIndex = Math.max(0, Math.min(this.draft.editingOrder.length - 1, currentIndex + direction));
    if (currentIndex === nextIndex) return;

    const nextOrder = [...this.draft.editingOrder];
    const [block] = nextOrder.splice(currentIndex, 1);
    if (!block) return;
    nextOrder.splice(nextIndex, 0, block);
    this.draft.editingOrder = nextOrder;
  }

  private cloneDraft(): VideoDraft {
    return { ...this.draft, editingOrder: [...this.draft.editingOrder] };
  }
}

import { FORMATS, TITLE_IDEAS } from "../game/videoData";
import type {
  EditingBlockId,
  FormatOption,
  PlayerState,
  ProgressionModifiers,
  VideoDraft,
  VideoResult
} from "../game/types";
import {
  createEditingBlockPresentations,
  type EditingBlockPresentation
} from "./EditingChallenge";
import {
  calculateHiddenVideoResult,
  createEditingChallenge,
  createShuffledEditingOrder,
  createVideoDraft,
  getProductionStages,
  type ProductionStage,
  validateVideoDraft
} from "./VideoProductionModel";
import {
  renderEditorView,
  renderPlannerView
} from "./VideoProductionTemplates";

interface ProductionHost {
  getState: () => PlayerState;
  getProgressionModifiers: () => ProgressionModifiers;
  onOpenChange: (open: boolean) => void;
  onProductionStart: (
    format: FormatOption,
    draft: VideoDraft
  ) => string | null;
  onRunProduction: (
    stages: ProductionStage[],
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ) => Promise<void>;
}

export class VideoProductionFlowV3 {
  private readonly overlay: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly host: ProductionHost;
  private draft: VideoDraft = createVideoDraft();
  private blockPresentations: Record<
    EditingBlockId,
    EditingBlockPresentation
  > = createEditingBlockPresentations();
  private draggedBlockId: EditingBlockId | null = null;
  private selectedBlockId: EditingBlockId | null = null;
  private opened = false;
  private starting = false;

  public constructor(container: HTMLElement, host: ProductionHost) {
    this.host = host;
    this.overlay = document.createElement("div");
    this.overlay.className = "production-overlay production-overlay--youtube";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.innerHTML = '<section class="production-panel" role="dialog" aria-modal="true"></section>';
    container.append(this.overlay);

    const panel = this.overlay.querySelector<HTMLElement>(".production-panel");
    if (!panel) throw new Error("Painel de produção não encontrado.");
    this.panel = panel;

    this.panel.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (target?.closest(".production-close") && !this.starting) {
        this.close();
      }
    });

    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay && !this.starting) this.close();
    });
  }

  public open(): string | null {
    if (this.opened) return null;

    const state = this.host.getState();
    if (state.energy < 18) return "Você precisa de pelo menos 18 de energia.";
    if (state.hunger < 20) return "Você está com muita fome para produzir.";
    if (state.creativity < 11) return "Recupere criatividade antes de produzir.";

    this.opened = true;
    this.starting = false;
    this.draggedBlockId = null;
    this.selectedBlockId = null;
    this.draft = createVideoDraft();
    this.blockPresentations = createEditingBlockPresentations();
    this.host.onOpenChange(true);
    this.overlay.classList.add("is-visible");
    this.overlay.setAttribute("aria-hidden", "false");
    this.renderPlanner(false);
    return null;
  }

  public close(): void {
    if (!this.opened || this.starting) return;
    this.opened = false;
    this.draggedBlockId = null;
    this.selectedBlockId = null;
    this.overlay.classList.remove("is-visible");
    this.overlay.setAttribute("aria-hidden", "true");
    this.host.onOpenChange(false);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public handleEscape(): boolean {
    if (!this.opened) return false;
    if (!this.starting) this.close();
    return true;
  }

  private renderPlanner(preserveScroll = true, errorMessage = ""): void {
    const previousScroll = preserveScroll
      ? this.panel.querySelector<HTMLElement>(".production-scroll")?.scrollTop ?? 0
      : 0;

    this.panel.innerHTML = renderPlannerView(
      this.draft,
      this.host.getState(),
      errorMessage
    );
    this.bindPlannerEvents();

    if (preserveScroll) {
      this.restoreScroll(previousScroll, 0, false);
    }
  }

  private bindPlannerEvents(): void {
    this.panel.querySelectorAll<HTMLElement>("[data-theme-id]").forEach((card) => {
      card.addEventListener("click", () => {
        this.draft.themeId = card.dataset.themeId as VideoDraft["themeId"];
        this.renderPlanner(true);
      });
    });

    this.panel.querySelectorAll<HTMLElement>("[data-format-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const nextFormatId = card.dataset.formatId as FormatOption["id"];
        if (this.draft.formatId !== nextFormatId) {
          this.draft.formatId = nextFormatId;
          const idealOrder = createEditingChallenge(nextFormatId);
          this.draft.editingIdealOrder = idealOrder;
          this.draft.editingOrder = createShuffledEditingOrder(idealOrder);
          this.blockPresentations = createEditingBlockPresentations();
          this.selectedBlockId = null;
        }
        this.renderPlanner(true);
      });
    });

    this.panel.querySelectorAll<HTMLElement>("[data-thumbnail-id]").forEach((card) => {
      card.addEventListener("click", () => {
        this.draft.thumbnailId = card.dataset.thumbnailId as VideoDraft["thumbnailId"];
        this.renderPlanner(true);
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
        this.renderPlanner(true, "Escolha um tema antes de gerar o título.");
        return;
      }
      const ideas = TITLE_IDEAS[this.draft.themeId];
      this.draft.title = ideas[Math.floor(Math.random() * ideas.length)] ?? "";
      this.renderPlanner(true);
    });

    this.panel.querySelector("#cancel-production")?.addEventListener("click", () => this.close());
    this.panel.querySelector("#continue-production")?.addEventListener("click", () => {
      const error = validateVideoDraft(
        this.draft,
        this.host.getState(),
        this.host.getProgressionModifiers()
      );
      if (error) this.renderPlanner(true, error);
      else this.renderEditor(false);
    });
  }

  private renderEditor(preserveScroll = true): void {
    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    if (!format) {
      this.renderPlanner(false, "Formato inválido.");
      return;
    }

    const scrollArea = this.panel.querySelector<HTMLElement>(".production-scroll");
    const timeline = this.panel.querySelector<HTMLElement>(".editing-timeline");
    const previousScroll = preserveScroll ? scrollArea?.scrollTop ?? 0 : 0;
    const previousHorizontalScroll = preserveScroll
      ? timeline?.scrollLeft ?? 0
      : 0;

    this.panel.innerHTML = renderEditorView(
      this.draft,
      format,
      this.blockPresentations,
      this.selectedBlockId
    );
    const startButton = this.panel.querySelector<HTMLButtonElement>(
      "#start-production"
    );
    if (startButton) startButton.textContent = "Produzir e publicar";
    this.bindEditorEvents();

    if (preserveScroll) {
      this.restoreScroll(previousScroll, previousHorizontalScroll, true);
    }
  }

  private bindEditorEvents(): void {
    this.panel.querySelector("#back-to-planner")?.addEventListener("click", () => {
      this.selectedBlockId = null;
      this.renderPlanner(false);
    });
    this.panel.querySelector("#start-production")?.addEventListener("click", () => void this.startProduction());

    this.panel.querySelectorAll<HTMLElement>("[data-block-id]").forEach((card) => {
      const blockId = card.dataset.blockId as EditingBlockId;

      card.addEventListener("dragstart", (event) => {
        this.draggedBlockId = blockId;
        card.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", blockId);
        }
      });
      card.addEventListener("dragend", () => {
        this.draggedBlockId = null;
        card.classList.remove("is-dragging");
        this.panel
          .querySelectorAll(".is-drop-target")
          .forEach((target) => target.classList.remove("is-drop-target"));
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        card.classList.add("is-drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        card.classList.remove("is-drop-target");
        const dragged = this.draggedBlockId ??
          (event.dataTransfer?.getData("text/plain") as EditingBlockId);
        if (!dragged || dragged === blockId) return;
        this.swapBlocks(dragged, blockId);
        this.draggedBlockId = null;
        this.selectedBlockId = null;
        this.renderEditor(true);
      });

      card.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.selectedBlockId = null;
          this.moveBlockBy(blockId, Number(button.dataset.move));
          this.renderEditor(true);
        });
      });

      card
        .querySelector<HTMLButtonElement>("[data-select-block]")
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          if (this.selectedBlockId === null) {
            this.selectedBlockId = blockId;
          } else if (this.selectedBlockId === blockId) {
            this.selectedBlockId = null;
          } else {
            this.swapBlocks(this.selectedBlockId, blockId);
            this.selectedBlockId = null;
          }
          this.renderEditor(true);
        });
    });
  }

  private async startProduction(): Promise<void> {
    if (this.starting) return;

    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    if (!format) return;
    const modifiers = this.host.getProgressionModifiers();

    const error = validateVideoDraft(
      this.draft,
      this.host.getState(),
      modifiers
    );
    if (error) {
      this.renderPlanner(false, error);
      return;
    }

    const startError = this.host.onProductionStart(format, this.cloneDraft());
    if (startError) {
      this.renderPlanner(false, startError);
      return;
    }

    this.starting = true;
    const draft = this.cloneDraft();
    const result = calculateHiddenVideoResult(
      draft,
      this.host.getState(),
      modifiers
    );
    const stages = getProductionStages(format, modifiers);

    this.opened = false;
    this.overlay.classList.remove("is-visible");
    this.overlay.setAttribute("aria-hidden", "true");
    this.host.onOpenChange(false);

    await this.host.onRunProduction(stages, result, format, draft);
    this.starting = false;
  }

  private swapBlocks(firstId: EditingBlockId, secondId: EditingBlockId): void {
    const firstIndex = this.draft.editingOrder.indexOf(firstId);
    const secondIndex = this.draft.editingOrder.indexOf(secondId);
    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return;

    const nextOrder = [...this.draft.editingOrder];
    [nextOrder[firstIndex], nextOrder[secondIndex]] = [
      nextOrder[secondIndex],
      nextOrder[firstIndex]
    ];
    this.draft.editingOrder = nextOrder;
  }

  private moveBlockBy(blockId: EditingBlockId, direction: number): void {
    const currentIndex = this.draft.editingOrder.indexOf(blockId);
    const nextIndex = Math.max(
      0,
      Math.min(this.draft.editingOrder.length - 1, currentIndex + direction)
    );
    if (currentIndex === nextIndex) return;

    const nextOrder = [...this.draft.editingOrder];
    const [block] = nextOrder.splice(currentIndex, 1);
    if (!block) return;
    nextOrder.splice(nextIndex, 0, block);
    this.draft.editingOrder = nextOrder;
  }

  private restoreScroll(
    verticalScroll: number,
    horizontalScroll: number,
    includeTimeline: boolean
  ): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollArea = this.panel.querySelector<HTMLElement>(
          ".production-scroll"
        );
        if (scrollArea) scrollArea.scrollTop = verticalScroll;

        if (includeTimeline) {
          const timeline = this.panel.querySelector<HTMLElement>(
            ".editing-timeline"
          );
          if (timeline) timeline.scrollLeft = horizontalScroll;
        }
      });
    });
  }

  private cloneDraft(): VideoDraft {
    return {
      ...this.draft,
      editingOrder: [...this.draft.editingOrder],
      editingIdealOrder: this.draft.editingIdealOrder
        ? [...this.draft.editingIdealOrder]
        : undefined
    };
  }
}

import {
  EDITING_BLOCKS,
  FORMATS,
  THEMES,
  THUMBNAILS,
  TITLE_IDEAS
} from "../game/videoData";
import type {
  EditingBlockId,
  FormatOption,
  PlayerState,
  VideoDraft,
  VideoResult
} from "../game/types";

interface ProductionHost {
  getState: () => PlayerState;
  onOpenChange: (open: boolean) => void;
  onPublish: (
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ) => void;
}

interface ExtendedVideoResult extends VideoResult {
  clickRate: number;
  retention: number;
  audienceReaction: string;
}

export class VideoProductionFlow {
  private readonly overlay: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly host: ProductionHost;

  private draft: VideoDraft = this.createDraft();
  private draggedBlockId: EditingBlockId | null = null;
  private opened = false;

  public constructor(container: HTMLElement, host: ProductionHost) {
    this.host = host;
    this.overlay = document.createElement("div");
    this.overlay.className = "production-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.innerHTML = `
      <section class="production-panel" role="dialog" aria-modal="true" aria-label="Produção de vídeo"></section>
    `;
    container.append(this.overlay);

    const panel = this.overlay.querySelector<HTMLElement>(".production-panel");

    if (!panel) {
      throw new Error("Painel de produção não encontrado.");
    }

    this.panel = panel;

    this.panel.addEventListener("click", (event) => {
      const target = event.target as Element | null;

      if (target?.closest(".production-close")) {
        this.close();
      }
    });

    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });
  }

  public get isOpen(): boolean {
    return this.opened;
  }

  public open(): string | null {
    if (this.opened) {
      return null;
    }

    const state = this.host.getState();

    if (state.energy < 18) {
      return "Você precisa de pelo menos 18 de energia para começar um vídeo.";
    }

    if (state.hunger < 20) {
      return "Você está com muita fome para iniciar uma produção.";
    }

    if (state.creativity < 11) {
      return "Você precisa recuperar criatividade antes de produzir.";
    }

    this.opened = true;
    this.draft = this.createDraft();
    this.host.onOpenChange(true);
    this.overlay.classList.add("is-visible");
    this.overlay.setAttribute("aria-hidden", "false");
    this.renderPlanner();
    return null;
  }

  public close(): void {
    if (!this.opened) {
      return;
    }

    this.opened = false;
    this.draggedBlockId = null;
    this.overlay.classList.remove("is-visible");
    this.overlay.setAttribute("aria-hidden", "true");
    this.host.onOpenChange(false);
  }

  public handleEscape(): boolean {
    if (!this.opened) {
      return false;
    }

    this.close();
    return true;
  }

  private createDraft(): VideoDraft {
    return {
      themeId: null,
      formatId: null,
      title: "",
      thumbnailId: null,
      editingOrder: this.shuffle(EDITING_BLOCKS.map((block) => block.id))
    };
  }

  private renderPlanner(errorMessage = ""): void {
    const state = this.host.getState();
    const selectedFormat = FORMATS.find(
      (format) => format.id === this.draft.formatId
    );

    this.panel.innerHTML = `
      ${this.renderHeader(
        1,
        "Planejamento do vídeo",
        "Defina a ideia, o formato e a apresentação antes de gravar."
      )}

      <div class="production-scroll">
        <section class="production-section">
          <div class="production-section__heading">
            <div><span>ETAPA 1</span><h3>Escolha o tema</h3></div>
            <small>O tema influencia tendência e compatibilidade.</small>
          </div>
          <div class="choice-grid choice-grid--themes">
            ${THEMES.map(
              (theme) => `
                <button
                  type="button"
                  class="production-choice ${
                    this.draft.themeId === theme.id ? "is-selected" : ""
                  }"
                  data-theme-id="${theme.id}"
                  style="--choice-accent: ${this.toHex(theme.color)}"
                >
                  <span class="production-choice__accent"></span>
                  <strong>${theme.label}</strong>
                  <p>${theme.description}</p>
                  <small>Tendência +${theme.trend}</small>
                </button>
              `
            ).join("")}
          </div>
        </section>

        <section class="production-section">
          <div class="production-section__heading">
            <div><span>ETAPA 2</span><h3>Escolha o formato</h3></div>
            <small>Formatos maiores exigem mais tempo e recursos.</small>
          </div>
          <div class="choice-grid choice-grid--formats">
            ${FORMATS.map((format) => {
              const compatible = this.draft.themeId
                ? format.idealThemes.includes(this.draft.themeId)
                : false;

              return `
                <button
                  type="button"
                  class="production-choice production-choice--format ${
                    this.draft.formatId === format.id ? "is-selected" : ""
                  }"
                  data-format-id="${format.id}"
                >
                  <div class="format-card__top">
                    <strong>${format.label}</strong>
                    ${
                      compatible
                        ? '<span class="compatibility-tag">Boa combinação</span>'
                        : ""
                    }
                  </div>
                  <p>${format.description}</p>
                  <div class="format-costs">
                    <span>${format.hours}h</span>
                    <span>${format.energyCost} energia</span>
                    <span>${format.creativityCost} criatividade</span>
                  </div>
                </button>
              `;
            }).join("")}
          </div>
        </section>

        <section class="production-section production-section--split">
          <div class="production-column">
            <div class="production-section__heading">
              <div><span>ETAPA 3</span><h3>Crie o título</h3></div>
            </div>
            <label class="title-field">
              <span>Título do vídeo</span>
              <input
                id="video-title-input"
                maxlength="58"
                autocomplete="off"
                placeholder="Digite um título chamativo"
                value="${this.escapeHtml(this.draft.title)}"
              />
              <small id="title-counter">${this.draft.title.length}/58 caracteres</small>
            </label>
            <button type="button" id="generate-title" class="production-link-button">
              Gerar uma ideia baseada no tema
            </button>
          </div>

          <div class="production-column">
            <div class="production-section__heading">
              <div><span>ETAPA 4</span><h3>Escolha a thumbnail</h3></div>
            </div>
            <div class="thumbnail-grid">
              ${THUMBNAILS.map(
                (thumbnail) => `
                  <button
                    type="button"
                    class="thumbnail-choice ${
                      this.draft.thumbnailId === thumbnail.id
                        ? "is-selected"
                        : ""
                    }"
                    data-thumbnail-id="${thumbnail.id}"
                    style="--thumbnail-accent: ${this.toHex(thumbnail.color)}"
                  >
                    ${this.renderThumbnailPreview(thumbnail.id, thumbnail.label)}
                    <div>
                      <strong>${thumbnail.label}</strong>
                      <small>${thumbnail.description}</small>
                    </div>
                  </button>
                `
              ).join("")}
            </div>
          </div>
        </section>
      </div>

      <footer class="production-footer">
        <div class="production-budget">
          <span>Recursos atuais</span>
          <strong>${state.energy} energia · ${state.creativity} criatividade</strong>
          <small>${
            selectedFormat
              ? `Produção selecionada: ${selectedFormat.hours} horas`
              : "Selecione um formato"
          }</small>
        </div>
        <div class="production-footer__actions">
          <span class="production-error" id="production-error">${errorMessage}</span>
          <button type="button" class="production-button production-button--secondary" id="cancel-production">Cancelar</button>
          <button type="button" class="production-button" id="continue-production">Gravar e editar</button>
        </div>
      </footer>
    `;

    this.bindPlannerEvents();
  }

  private bindPlannerEvents(): void {
    this.panel
      .querySelectorAll<HTMLElement>("[data-theme-id]")
      .forEach((card) => {
        card.addEventListener("click", () => {
          this.draft.themeId = card.dataset.themeId as VideoDraft["themeId"];
          this.renderPlanner();
        });
      });

    this.panel
      .querySelectorAll<HTMLElement>("[data-format-id]")
      .forEach((card) => {
        card.addEventListener("click", () => {
          this.draft.formatId = card.dataset.formatId as VideoDraft["formatId"];
          this.renderPlanner();
        });
      });

    this.panel
      .querySelectorAll<HTMLElement>("[data-thumbnail-id]")
      .forEach((card) => {
        card.addEventListener("click", () => {
          this.draft.thumbnailId = card.dataset
            .thumbnailId as VideoDraft["thumbnailId"];
          this.renderPlanner();
        });
      });

    const titleInput = this.panel.querySelector<HTMLInputElement>(
      "#video-title-input"
    );
    const titleCounter = this.panel.querySelector<HTMLElement>("#title-counter");

    titleInput?.addEventListener("input", () => {
      this.draft.title = titleInput.value;

      if (titleCounter) {
        titleCounter.textContent = `${titleInput.value.length}/58 caracteres`;
      }
    });

    this.panel
      .querySelector("#generate-title")
      ?.addEventListener("click", () => {
        if (!this.draft.themeId) {
          this.renderPlanner("Escolha um tema antes de gerar o título.");
          return;
        }

        const ideas = TITLE_IDEAS[this.draft.themeId];
        this.draft.title =
          ideas[Math.floor(Math.random() * ideas.length)] ?? "";
        this.renderPlanner();
      });

    this.panel
      .querySelector("#cancel-production")
      ?.addEventListener("click", () => {
        this.close();
      });

    this.panel
      .querySelector("#continue-production")
      ?.addEventListener("click", () => {
        const validation = this.validatePlanner();

        if (validation) {
          this.renderPlanner(validation);
          return;
        }

        this.renderEditor();
      });
  }

  private validatePlanner(): string | null {
    if (!this.draft.themeId) {
      return "Escolha o tema do vídeo.";
    }

    if (!this.draft.formatId) {
      return "Escolha o formato do vídeo.";
    }

    if (this.draft.title.trim().length < 8) {
      return "O título precisa ter pelo menos 8 caracteres.";
    }

    if (!this.draft.thumbnailId) {
      return "Escolha um estilo de thumbnail.";
    }

    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    const state = this.host.getState();

    if (!format) {
      return "Formato inválido.";
    }

    if (state.energy < format.energyCost) {
      return `Este formato exige ${format.energyCost} de energia.`;
    }

    if (state.creativity < format.creativityCost) {
      return `Este formato exige ${format.creativityCost} de criatividade.`;
    }

    return null;
  }

  private renderEditor(): void {
    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    const theme = THEMES.find((item) => item.id === this.draft.themeId);
    const thumbnail = THUMBNAILS.find(
      (item) => item.id === this.draft.thumbnailId
    );
    const editingScore = this.calculateEditingScore();

    if (!format || !theme || !thumbnail) {
      this.renderPlanner("O planejamento está incompleto.");
      return;
    }

    this.panel.innerHTML = `
      ${this.renderHeader(
        2,
        "Mesa de edição",
        "Organize os trechos na ordem que mantém o público assistindo."
      )}

      <div class="production-scroll editor-layout">
        <section class="video-summary-card">
          <div class="video-summary-card__thumbnail" style="--thumbnail-accent: ${this.toHex(
            thumbnail.color
          )}">
            ${this.renderThumbnailPreview(thumbnail.id, thumbnail.label)}
          </div>
          <div>
            <span>${theme.label} · ${format.label}</span>
            <h3>${this.escapeHtml(this.draft.title)}</h3>
            <div class="video-summary-meta">
              <span>${format.hours} horas</span>
              <span>${format.energyCost} energia</span>
              <span>${format.creativityCost} criatividade</span>
            </div>
          </div>
        </section>

        <section class="editing-workspace">
          <div class="editing-workspace__header">
            <div>
              <span>LINHA DO TEMPO</span>
              <h3>Monte a estrutura do vídeo</h3>
            </div>
            <div class="editing-score ${
              editingScore >= 80
                ? "is-high"
                : editingScore >= 55
                  ? "is-medium"
                  : "is-low"
            }">
              <span>Qualidade da edição</span>
              <strong>${editingScore}/100</strong>
            </div>
          </div>

          <div class="timeline-ruler">
            ${this.draft.editingOrder
              .map((_, index) => `<span>Parte ${index + 1}</span>`)
              .join("")}
          </div>

          <div class="editing-timeline" id="editing-timeline">
            ${this.draft.editingOrder
              .map((blockId, index) => {
                const block = EDITING_BLOCKS.find(
                  (item) => item.id === blockId
                );

                if (!block) {
                  return "";
                }

                return `
                  <article
                    class="editing-block"
                    draggable="true"
                    data-block-id="${block.id}"
                    style="--block-color: ${this.toHex(block.color)}"
                  >
                    <span class="editing-block__number">${index + 1}</span>
                    <span class="editing-block__color"></span>
                    <strong>${block.shortLabel}</strong>
                    <p>${block.description}</p>
                    <div class="editing-block__controls">
                      <button type="button" data-move="-1" aria-label="Mover ${block.label} para esquerda">←</button>
                      <span>ARRASTE</span>
                      <button type="button" data-move="1" aria-label="Mover ${block.label} para direita">→</button>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>

          <div class="editing-hint">
            <strong>${this.getEditingLabel(editingScore)}</strong>
            <span>A posição correta e a ligação entre blocos aumentam a retenção.</span>
          </div>
        </section>
      </div>

      <footer class="production-footer">
        <div class="production-budget">
          <span>Dica de edição</span>
          <strong>Comece forte e termine pedindo uma ação clara.</strong>
          <small>A ordem ideal pode mudar de acordo com o formato.</small>
        </div>
        <div class="production-footer__actions">
          <button type="button" class="production-button production-button--secondary" id="back-to-planner">Voltar</button>
          <button type="button" class="production-button" id="publish-video">Publicar vídeo</button>
        </div>
      </footer>
    `;

    this.bindEditorEvents();
  }

  private bindEditorEvents(): void {
    this.panel
      .querySelector("#back-to-planner")
      ?.addEventListener("click", () => {
        this.renderPlanner();
      });

    this.panel
      .querySelector("#publish-video")
      ?.addEventListener("click", () => {
        const format = FORMATS.find(
          (item) => item.id === this.draft.formatId
        );

        if (!format) {
          return;
        }

        const result = this.calculateVideoResult();
        this.host.onPublish(result, format, this.cloneDraft());
        this.renderResult(result);
      });

    this.panel
      .querySelectorAll<HTMLElement>("[data-block-id]")
      .forEach((card) => {
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

        card.addEventListener("dragleave", () => {
          card.classList.remove("is-drop-target");
        });

        card.addEventListener("drop", (event) => {
          event.preventDefault();
          card.classList.remove("is-drop-target");

          const dragged =
            this.draggedBlockId ??
            (event.dataTransfer?.getData("text/plain") as EditingBlockId);

          if (!dragged || dragged === blockId) {
            return;
          }

          this.moveBlockBefore(dragged, blockId);
          this.renderEditor();
        });

        card
          .querySelectorAll<HTMLButtonElement>("[data-move]")
          .forEach((button) => {
            button.addEventListener("click", () => {
              const direction = Number(button.dataset.move);
              this.moveBlockBy(blockId, direction);
              this.renderEditor();
            });
          });
      });
  }

  private moveBlockBefore(
    draggedId: EditingBlockId,
    targetId: EditingBlockId
  ): void {
    const nextOrder = this.draft.editingOrder.filter(
      (id) => id !== draggedId
    );
    const targetIndex = nextOrder.indexOf(targetId);
    nextOrder.splice(targetIndex, 0, draggedId);
    this.draft.editingOrder = nextOrder;
  }

  private moveBlockBy(blockId: EditingBlockId, direction: number): void {
    const currentIndex = this.draft.editingOrder.indexOf(blockId);
    const nextIndex = Math.max(
      0,
      Math.min(
        this.draft.editingOrder.length - 1,
        currentIndex + direction
      )
    );

    if (currentIndex === nextIndex) {
      return;
    }

    const nextOrder = [...this.draft.editingOrder];
    const [block] = nextOrder.splice(currentIndex, 1);

    if (!block) {
      return;
    }

    nextOrder.splice(nextIndex, 0, block);
    this.draft.editingOrder = nextOrder;
  }

  private calculateEditingScore(): number {
    const format = FORMATS.find((item) => item.id === this.draft.formatId);

    if (!format) {
      return 0;
    }

    let score = 20;

    this.draft.editingOrder.forEach((blockId, index) => {
      if (blockId === format.idealOrder[index]) {
        score += 12;
      }
    });

    for (
      let index = 0;
      index < this.draft.editingOrder.length - 1;
      index += 1
    ) {
      const current = this.draft.editingOrder[index];
      const next = this.draft.editingOrder[index + 1];
      const idealCurrentIndex = format.idealOrder.indexOf(current);

      if (format.idealOrder[idealCurrentIndex + 1] === next) {
        score += 5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateVideoResult(): ExtendedVideoResult {
    const state = this.host.getState();
    const theme = THEMES.find((item) => item.id === this.draft.themeId);
    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    const thumbnail = THUMBNAILS.find(
      (item) => item.id === this.draft.thumbnailId
    );

    if (!theme || !format || !thumbnail) {
      throw new Error("Rascunho de vídeo incompleto.");
    }

    const titleScore = this.calculateTitleScore(this.draft.title);
    const compatibilityBonus = format.idealThemes.includes(theme.id) ? 12 : 2;
    const planningScore = Math.max(
      0,
      Math.min(
        100,
        35 +
          theme.trend +
          compatibilityBonus +
          titleScore * 0.25 +
          thumbnail.clickBonus +
          thumbnail.credibilityBonus
      )
    );
    const editingScore = this.calculateEditingScore();
    const quality = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          planningScore * 0.42 +
            editingScore * 0.43 +
            state.creativity * 0.15 +
            format.qualityBonus
        )
      )
    );

    const recommendationMultiplier = 0.72 + Math.random() * 0.86;
    const audienceBase =
      35 + state.videos * 14 + state.subscribers * 0.2;
    const views = Math.max(
      8,
      Math.floor(
        (audienceBase + quality * 3.1 + planningScore * 1.25) *
          recommendationMultiplier *
          format.reachMultiplier
      )
    );
    const subscriberRate = Math.max(
      0.025,
      Math.min(0.085, 0.022 + quality / 1800)
    );
    const subscribers = Math.max(
      1,
      Math.floor(views * subscriberRate)
    );
    const revenue = state.subscribers >= 1000 ? views * 0.006 : 0;
    const clickRate = Math.max(
      2.1,
      Math.min(
        14.8,
        3.4 + titleScore * 0.045 + thumbnail.clickBonus * 0.19
      )
    );
    const retention = Math.max(
      12,
      Math.min(92, 18 + editingScore * 0.62 + quality * 0.12)
    );

    const performanceLabel =
      recommendationMultiplier >= 1.38
        ? "O algoritmo ampliou a distribuição do vídeo."
        : recommendationMultiplier <= 0.85
          ? "A distribuição inicial ficou abaixo do esperado."
          : "O vídeo alcançou o público esperado para o canal.";

    const audienceReaction =
      quality >= 85
        ? "O público elogiou a edição e pediu uma continuação."
        : editingScore >= 70
          ? "Os espectadores permaneceram até as partes finais."
          : planningScore >= 70
            ? "A thumbnail atraiu cliques, mas parte do público saiu cedo."
            : "O vídeo trouxe experiência, mas precisa de uma ideia mais forte.";

    return {
      quality,
      planningScore: Math.round(planningScore),
      editingScore,
      titleScore,
      views,
      subscribers,
      revenue,
      performanceLabel,
      clickRate,
      retention,
      audienceReaction
    };
  }

  private calculateTitleScore(title: string): number {
    const normalizedTitle = title.trim();
    let score = 35;

    if (normalizedTitle.length >= 22 && normalizedTitle.length <= 52) {
      score += 25;
    } else if (normalizedTitle.length >= 12) {
      score += 12;
    }

    if (normalizedTitle.includes("?")) {
      score += 8;
    }

    if (/\d/.test(normalizedTitle)) {
      score += 7;
    }

    const strongWords = [
      "como",
      "testei",
      "melhor",
      "pior",
      "guia",
      "segredo",
      "mudou",
      "zero"
    ];
    const lowerTitle = normalizedTitle.toLocaleLowerCase("pt-BR");

    score +=
      strongWords.filter((word) => lowerTitle.includes(word)).length * 5;

    if (
      normalizedTitle === normalizedTitle.toUpperCase() &&
      normalizedTitle.length > 12
    ) {
      score -= 12;
    }

    return Math.max(0, Math.min(100, score));
  }

  private renderResult(result: ExtendedVideoResult): void {
    const qualityClass =
      result.quality >= 80
        ? "is-excellent"
        : result.quality >= 60
          ? "is-good"
          : "is-weak";

    this.panel.innerHTML = `
      ${this.renderHeader(3, "Vídeo publicado", result.performanceLabel)}

      <div class="production-scroll result-layout">
        <section class="result-hero">
          <div class="quality-orb ${qualityClass}">
            <span>QUALIDADE</span>
            <strong>${result.quality}</strong>
            <small>/100</small>
          </div>
          <div class="result-hero__content">
            <span>PUBLICADO COM SUCESSO</span>
            <h3>${this.escapeHtml(this.draft.title)}</h3>
            <p>${result.audienceReaction}</p>
          </div>
        </section>

        <section class="result-grid">
          ${this.renderResultMetric(
            "Visualizações",
            `+${result.views.toLocaleString("pt-BR")}`,
            "Alcance total do vídeo"
          )}
          ${this.renderResultMetric(
            "Novos inscritos",
            `+${result.subscribers.toLocaleString("pt-BR")}`,
            "Conversão para o canal"
          )}
          ${this.renderResultMetric(
            "Taxa de clique",
            `${result.clickRate.toFixed(1)}%`,
            "Força de título e thumbnail"
          )}
          ${this.renderResultMetric(
            "Retenção",
            `${Math.round(result.retention)}%`,
            "Público que continuou assistindo"
          )}
          ${this.renderResultMetric(
            "Planejamento",
            `${result.planningScore}/100`,
            "Tema, formato e apresentação"
          )}
          ${this.renderResultMetric(
            "Edição",
            `${result.editingScore}/100`,
            "Estrutura da linha do tempo"
          )}
        </section>

        <section class="result-revenue">
          <div>
            <span>Receita estimada</span>
            <strong>${
              result.revenue > 0
                ? `R$ ${result.revenue.toFixed(2)}`
                : "Canal não monetizado"
            }</strong>
          </div>
          <p>${
            result.revenue > 0
              ? "A receita foi adicionada ao saldo."
              : "Alcance 1.000 inscritos para liberar receita por anúncios."
          }</p>
        </section>
      </div>

      <footer class="production-footer production-footer--result">
        <div class="production-budget">
          <span>Próximo passo</span>
          <strong>Analise o resultado e produza novamente com uma estratégia melhor.</strong>
          <small>O canal cresce de forma acumulativa a cada publicação.</small>
        </div>
        <button type="button" class="production-button" id="finish-production">Voltar ao quarto</button>
      </footer>
    `;

    this.panel
      .querySelector("#finish-production")
      ?.addEventListener("click", () => {
        this.close();
      });
  }

  private renderHeader(
    step: number,
    title: string,
    subtitle: string
  ): string {
    return `
      <header class="production-header">
        <div>
          <span class="production-header__eyebrow">ESTAÇÃO DE PRODUÇÃO</span>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <div class="production-progress" aria-label="Progresso da produção">
          ${[1, 2, 3]
            .map(
              (item) => `
                <span class="${item <= step ? "is-active" : ""}">${item}</span>
              `
            )
            .join("<i></i>")}
        </div>
        <button type="button" class="production-close" aria-label="Fechar produção">×</button>
      </header>
    `;
  }

  private renderThumbnailPreview(id: string, label: string): string {
    const content =
      id === "expressive"
        ? '<span class="thumb-face">!</span><b>VOCÊ PRECISA VER</b>'
        : id === "clean"
          ? '<span class="thumb-clean-shape"></span><b>GUIA COMPLETO</b>'
          : id === "big-text"
            ? '<b class="thumb-big-text">MUDOU TUDO</b>'
            : '<span class="thumb-scene-shape"></span><b>O QUE ACONTECEU?</b>';

    return `<div class="thumbnail-preview thumbnail-preview--${id}" aria-label="Prévia ${label}">${content}</div>`;
  }

  private renderResultMetric(
    label: string,
    value: string,
    description: string
  ): string {
    return `
      <article class="result-metric">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${description}</small>
      </article>
    `;
  }

  private getEditingLabel(score: number): string {
    if (score >= 85) {
      return "Excelente ritmo: a narrativa está muito bem conectada.";
    }

    if (score >= 65) {
      return "Boa sequência: poucos ajustes podem melhorar a retenção.";
    }

    if (score >= 45) {
      return "Sequência aceitável: alguns trechos quebram o ritmo.";
    }

    return "A ordem pode melhorar: reorganize os blocos antes de publicar.";
  }

  private cloneDraft(): VideoDraft {
    return {
      ...this.draft,
      editingOrder: [...this.draft.editingOrder]
    };
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];

    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [
        result[randomIndex],
        result[index]
      ];
    }

    return result;
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

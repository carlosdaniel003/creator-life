interface PauseStorySummary {
  day: number;
  time: string;
  age: number;
  videos: number;
  subscribers: number;
}

interface PauseMenuHost {
  canOpen: () => boolean;
  onBlocked: () => void;
  getSummary: () => PauseStorySummary;
  onPauseChange: (paused: boolean) => void;
  onSave: () => void;
  onNewStory: () => void;
}

export class PauseMenuController {
  private readonly button: HTMLButtonElement;
  private readonly overlay: HTMLElement;
  private readonly panel: HTMLElement;
  private opened = false;
  private confirmingNewStory = false;
  private disabled = false;

  public constructor(
    private readonly container: HTMLElement,
    private readonly host: PauseMenuHost
  ) {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "game-pause-button";
    this.button.innerHTML = '<span>Ⅱ</span><strong>Pausar</strong><kbd>P</kbd>';
    this.button.setAttribute("aria-label", "Pausar o jogo");
    this.container.append(this.button);

    this.overlay = document.createElement("div");
    this.overlay.className = "pause-menu-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.innerHTML = '<section class="pause-menu-panel" role="dialog" aria-modal="true" aria-labelledby="pause-menu-title"></section>';
    this.container.append(this.overlay);

    const panel = this.overlay.querySelector<HTMLElement>(".pause-menu-panel");
    if (!panel) throw new Error("Painel de pausa não encontrado.");
    this.panel = panel;

    this.button.addEventListener("click", () => this.toggle());
    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay && !this.confirmingNewStory) {
        this.close();
      }
    });

    window.addEventListener(
      "keydown",
      (event) => {
        const target = event.target as HTMLElement | null;
        const isTyping =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable;
        if (isTyping && !this.opened) return;

        if (event.key.toLocaleLowerCase("pt-BR") === "p") {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.toggle();
          return;
        }

        if (!this.opened) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Escape") {
          if (this.confirmingNewStory) {
            this.confirmingNewStory = false;
            this.renderMain();
          } else {
            this.close();
          }
        }
      },
      true
    );

    window.addEventListener(
      "keyup",
      (event) => {
        if (!this.opened) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true
    );
  }

  public setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.button.disabled = disabled;
    this.button.classList.toggle("is-disabled", disabled);
    this.button.setAttribute("aria-disabled", String(disabled));
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public open(): void {
    if (this.opened) return;
    if (this.disabled || !this.host.canOpen()) {
      this.host.onBlocked();
      return;
    }

    this.releaseMovementKeys();
    this.opened = true;
    this.confirmingNewStory = false;
    this.host.onPauseChange(true);
    this.renderMain();
    this.overlay.classList.add("is-visible");
    this.overlay.setAttribute("aria-hidden", "false");
    this.button.classList.add("is-paused");
    this.button.querySelector("strong")!.textContent = "Pausado";
  }

  public close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.confirmingNewStory = false;
    this.overlay.classList.remove("is-visible");
    this.overlay.setAttribute("aria-hidden", "true");
    this.button.classList.remove("is-paused");
    this.button.querySelector("strong")!.textContent = "Pausar";
    this.host.onPauseChange(false);
  }

  private toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  private releaseMovementKeys(): void {
    ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].forEach(
      (key) => {
        window.dispatchEvent(
          new KeyboardEvent("keyup", {
            key,
            bubbles: true,
            cancelable: true
          })
        );
      }
    );
  }

  private renderMain(message = ""): void {
    const summary = this.host.getSummary();
    this.panel.innerHTML = `
      <header class="pause-menu-header">
        <div><span>CREATOR LIFE</span><h2 id="pause-menu-title">Jogo pausado</h2><p>O relógio, o clima e as necessidades estão congelados.</p></div>
        <div class="pause-menu-symbol">Ⅱ</div>
      </header>
      ${message ? `<p class="pause-menu-message">${message}</p>` : ""}
      <section class="pause-story-summary">
        <article><span>História atual</span><strong>Dia ${summary.day} · ${summary.time}</strong><small>${summary.age} anos</small></article>
        <article><span>Canal</span><strong>${summary.videos} vídeos</strong><small>${summary.subscribers.toLocaleString("pt-BR")} inscritos</small></article>
      </section>
      <section class="pause-menu-actions">
        <button type="button" class="pause-action pause-action--primary" id="pause-resume"><span>▶</span><div><strong>Continuar história</strong><small>Voltar exatamente ao ponto atual</small></div></button>
        <button type="button" class="pause-action" id="pause-save"><span>✓</span><div><strong>Salvar agora</strong><small>O jogo também salva automaticamente</small></div></button>
        <button type="button" class="pause-action pause-action--danger" id="pause-new-story"><span>＋</span><div><strong>Nova história</strong><small>Começar do zero com um novo save</small></div></button>
      </section>
      <footer class="pause-menu-footer"><span>Atalho</span><kbd>P</kbd><small>para pausar ou continuar</small></footer>
    `;

    this.panel.querySelector("#pause-resume")?.addEventListener("click", () => this.close());
    this.panel.querySelector("#pause-save")?.addEventListener("click", () => {
      this.host.onSave();
      this.renderMain("Salvamento solicitado e registrado pelo autosave.");
    });
    this.panel.querySelector("#pause-new-story")?.addEventListener("click", () => {
      this.confirmingNewStory = true;
      this.renderNewStoryConfirmation();
    });
  }

  private renderNewStoryConfirmation(): void {
    this.panel.innerHTML = `
      <header class="pause-menu-header pause-menu-header--danger">
        <div><span>NOVA HISTÓRIA</span><h2 id="pause-menu-title">Começar do zero?</h2><p>Esta ação substituirá o save automático da história atual.</p></div>
        <div class="pause-menu-symbol">!</div>
      </header>
      <section class="new-story-warning">
        <strong>O que será reiniciado</strong>
        <div><span>Canal, vídeos e inscritos</span><span>Dinheiro, contas e faculdade</span><span>Quarto, equipamentos e cursos</span><span>Livros, idade e calendário</span></div>
        <p>Esta ação não pode ser desfeita pelo menu do jogo.</p>
      </section>
      <section class="pause-confirm-actions">
        <button type="button" class="pause-confirm-button" id="pause-cancel-new">Manter história atual</button>
        <button type="button" class="pause-confirm-button pause-confirm-button--danger" id="pause-confirm-new">Apagar e começar</button>
      </section>
    `;

    this.panel.querySelector("#pause-cancel-new")?.addEventListener("click", () => {
      this.confirmingNewStory = false;
      this.renderMain();
    });
    this.panel.querySelector("#pause-confirm-new")?.addEventListener("click", () => {
      this.host.onNewStory();
    });
  }
}

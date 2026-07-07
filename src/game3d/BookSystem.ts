import type {
  BookId,
  PlayerState,
  ProgressionModifiers,
  ReadingSave,
  SkillId
} from "../game/types";
import "../learning-center.css";
import "./ProgressionExperiencePatch";

interface BookDefinition {
  id: BookId;
  title: string;
  author: string;
  description: string;
  hours: number;
  skill: SkillId;
  benefit: string;
}

interface BookHost {
  getState: () => PlayerState & { thirst: number };
  onChange: () => void;
  onBookCompleted: (skill: SkillId, title: string) => void;
}

interface ReadingSessionResult {
  error: string | null;
  completed: boolean;
  message: string;
}

export const BOOKS: BookDefinition[] = [
  {
    id: "editing-rhythm",
    title: "O Ritmo do Corte",
    author: "Lina Prado",
    description: "Ritmo, continuidade, cortes e organização da narrativa visual.",
    hours: 18,
    skill: "editing",
    benefit: "Melhora retenção, edição e velocidade de montagem"
  },
  {
    id: "camera-confidence",
    title: "Fale para a Câmera",
    author: "Rafael Monte",
    description: "Presença, clareza, respiração e conexão com quem assiste.",
    hours: 20,
    skill: "communication",
    benefit: "Melhora qualidade audiovisual e conversão em inscritos"
  },
  {
    id: "click-design",
    title: "Design que Clica",
    author: "Maya Torres",
    description: "Hierarquia, contraste e leitura rápida para títulos e thumbnails.",
    hours: 16,
    skill: "design",
    benefit: "Aumenta força de títulos, thumbnails e taxa de cliques"
  },
  {
    id: "retention-script",
    title: "Roteiros que Prendem",
    author: "Caio Mendonça",
    description: "Promessa, gancho, progressão e recompensa narrativa.",
    hours: 22,
    skill: "scripting",
    benefit: "Melhora planejamento, retenção e força de séries"
  },
  {
    id: "creator-technology",
    title: "Manual do Criador Técnico",
    author: "Nina Albuquerque",
    description: "Fluxo técnico, organização, diagnóstico e uso eficiente da máquina.",
    hours: 24,
    skill: "technology",
    benefit: "Melhora produtividade técnica, manutenção e renda freelance"
  },
  {
    id: "patient-audience",
    title: "Audiência sem Atalhos",
    author: "Victor Salles",
    description: "Catálogo, posicionamento, paciência e construção de público.",
    hours: 26,
    skill: "marketing",
    benefit: "Melhora impressões, nicho, distribuição e consistência"
  }
];

export class BookSystem {
  private save: ReadingSave;

  public constructor(private readonly host: BookHost) {
    this.save = this.createDefaultSave();
  }

  public restore(saved: Partial<ReadingSave> | null): void {
    const defaults = this.createDefaultSave();
    this.save = {
      books: BOOKS.map((book) => {
        const existing = saved?.books?.find((item) => item.bookId === book.id);
        return existing
          ? {
              bookId: book.id,
              hoursRead: Math.max(
                0,
                Math.min(book.hours, Number(existing.hoursRead ?? 0))
              ),
              completed: Boolean(existing.completed)
            }
          : { bookId: book.id, hoursRead: 0, completed: false };
      }),
      completedBooks: Array.isArray(saved?.completedBooks)
        ? saved.completedBooks.filter((id): id is BookId =>
            BOOKS.some((book) => book.id === id)
          )
        : defaults.completedBooks,
      totalReadingHours: Number.isFinite(saved?.totalReadingHours)
        ? Number(saved?.totalReadingHours)
        : 0
    };
  }

  public serialize(): ReadingSave {
    return {
      books: this.save.books.map((book) => ({ ...book })),
      completedBooks: [...this.save.completedBooks],
      totalReadingHours: this.save.totalReadingHours
    };
  }

  public canStartSession(bookId: BookId, hours: 2 | 4): string | null {
    const state = this.host.getState();
    const progress = this.save.books.find((item) => item.bookId === bookId);
    if (!progress) return "Livro não encontrado.";
    if (progress.completed) return "Este livro já foi concluído.";

    const energyCost = hours === 2 ? 7 : 15;
    if (state.energy < energyCost) {
      return `Você precisa de ${energyCost} de energia para esta sessão.`;
    }
    if (state.hunger < 14 || state.thirst < 14) {
      return "Coma e beba água antes de iniciar uma leitura longa.";
    }
    return null;
  }

  public beginSession(bookId: BookId, hours: 2 | 4): string | null {
    const error = this.canStartSession(bookId, hours);
    if (error) return error;

    const state = this.host.getState();
    state.energy = Math.max(0, state.energy - (hours === 2 ? 7 : 15));
    state.creativity = Math.min(100, state.creativity + hours * 0.65);
    this.host.onChange();
    return null;
  }

  public completeSession(bookId: BookId, hours: 2 | 4): ReadingSessionResult {
    const book = BOOKS.find((item) => item.id === bookId);
    const progress = this.save.books.find((item) => item.bookId === bookId);
    if (!book || !progress) {
      return { error: "Livro não encontrado.", completed: false, message: "" };
    }

    const previousPercentage = (progress.hoursRead / book.hours) * 100;
    progress.hoursRead = Math.min(book.hours, progress.hoursRead + hours);
    this.save.totalReadingHours += hours;
    const percentage = (progress.hoursRead / book.hours) * 100;
    const unlockedMilestones = [25, 50, 75, 100].filter(
      (milestone) =>
        previousPercentage < milestone && percentage >= milestone
    );
    let completedNow = false;

    if (progress.hoursRead >= book.hours && !progress.completed) {
      progress.completed = true;
      completedNow = true;
      if (!this.save.completedBooks.includes(book.id)) {
        this.save.completedBooks.push(book.id);
      }
      this.host.onBookCompleted(book.skill, book.title);
    }

    this.host.onChange();
    const milestoneMessage = unlockedMilestones.length
      ? ` Marco ${unlockedMilestones[unlockedMilestones.length - 1]}% desbloqueado: ${this.getMilestoneBenefit(book, unlockedMilestones[unlockedMilestones.length - 1])}.`
      : "";

    return {
      error: null,
      completed: completedNow,
      message: completedNow
        ? `${book.title} concluído. ${book.benefit}.`
        : `${hours}h lidas. Progresso: ${progress.hoursRead}/${book.hours}h.${milestoneMessage}`
    };
  }

  public applyModifiers(base: ProgressionModifiers): ProgressionModifiers {
    const modifiers: ProgressionModifiers = {
      ...base,
      stageTimeMultipliers: { ...base.stageTimeMultipliers }
    };

    for (const book of BOOKS) {
      const progress = this.save.books.find((item) => item.bookId === book.id);
      if (!progress) continue;
      const fraction = Math.max(0, Math.min(1, progress.hoursRead / book.hours));
      const milestonePower =
        fraction >= 1
          ? 1
          : fraction >= 0.75
            ? 0.72
            : fraction >= 0.5
              ? 0.46
              : fraction >= 0.25
                ? 0.22
                : 0;
      if (milestonePower <= 0) continue;

      switch (book.id) {
        case "editing-rhythm":
          modifiers.editingBonus += 5 * milestonePower;
          modifiers.stageTimeMultipliers.editing *=
            1 - 0.05 * milestonePower;
          break;
        case "camera-confidence":
          modifiers.audioVisualBonus += 4 * milestonePower;
          modifiers.qualityConsistency = Math.min(
            0.98,
            modifiers.qualityConsistency + 0.035 * milestonePower
          );
          break;
        case "click-design":
          modifiers.titleBonus += 5 * milestonePower;
          modifiers.planningBonus += 1.5 * milestonePower;
          break;
        case "retention-script":
          modifiers.planningBonus += 5 * milestonePower;
          modifiers.stageTimeMultipliers.planning *=
            1 - 0.05 * milestonePower;
          break;
        case "creator-technology":
          modifiers.editingBonus += 2 * milestonePower;
          modifiers.freelanceIncomeMultiplier += 0.08 * milestonePower;
          break;
        case "patient-audience":
          modifiers.titleBonus += 4 * milestonePower;
          modifiers.planningBonus += 4 * milestonePower;
          modifiers.qualityConsistency = Math.min(
            0.98,
            modifiers.qualityConsistency + 0.025 * milestonePower
          );
          break;
      }
    }

    modifiers.qualityCeiling = Math.min(
      99,
      modifiers.qualityCeiling + this.getKnowledgePower() * 0.8
    );
    return modifiers;
  }

  public renderLibraryHtml(message = ""): string {
    const completed = this.save.completedBooks.length;
    const bridge = window.__creatorLifeProgressionBridge;
    return `
      ${message ? `<p class="reading-message">${this.escapeHtml(message)}</p>` : ""}
      <section class="learning-center-hero">
        <div><span>CENTRO DE APRENDIZADO</span><h3>Livros e cursos</h3><p>Livros liberam conhecimento progressivo. Cursos aumentam o limite das habilidades. A prática transforma ambos em resultados.</p></div>
        <div><strong>${this.save.totalReadingHours.toFixed(0)}h</strong><span>de leitura</span><small>${completed}/${BOOKS.length} livros concluídos</small></div>
      </section>
      <nav class="learning-tabs">
        <button type="button" class="is-active" data-learning-tab="books">Livros</button>
        <button type="button" data-learning-tab="courses">Cursos profissionais</button>
      </nav>
      <section data-learning-panel="books">
        <section class="reading-summary">
          <div><span>Biblioteca</span><strong>${completed}/${BOOKS.length} livros</strong></div>
          <div><span>Conhecimento</span><strong>${Math.round(this.getKnowledgePower() * 100)}%</strong></div>
          <div><span>Modelo</span><strong>Marcos progressivos</strong></div>
        </section>
        <section class="book-grid">${BOOKS.map((book) => this.renderBook(book)).join("")}</section>
      </section>
      <section data-learning-panel="courses" hidden>
        ${bridge?.renderCoursesHtml() ?? '<p class="learning-message">Formação ainda indisponível.</p>'}
        ${bridge?.renderSkillsHtml() ?? ""}
      </section>
    `;
  }

  public bindLibraryEvents(
    root: HTMLElement,
    onRead: (bookId: BookId, hours: 2 | 4) => void
  ): void {
    root
      .querySelectorAll<HTMLButtonElement>("[data-read-book]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const bookId = button.dataset.readBook as BookId;
          const hours = Number(button.dataset.hours) === 4 ? 4 : 2;
          onRead(bookId, hours);
        });
      });

    root
      .querySelectorAll<HTMLButtonElement>("[data-learning-tab]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const tab = button.dataset.learningTab ?? "books";
          root
            .querySelectorAll<HTMLElement>("[data-learning-panel]")
            .forEach((panel) => {
              panel.hidden = panel.dataset.learningPanel !== tab;
            });
          root
            .querySelectorAll("[data-learning-tab]")
            .forEach((item) => item.classList.remove("is-active"));
          button.classList.add("is-active");
        });
      });

    window.__creatorLifeProgressionBridge?.bindCourseEvents(
      root,
      (message) => {
        const messageElement = root.querySelector<HTMLElement>(
          ".reading-message, .learning-message"
        );
        if (messageElement) {
          messageElement.textContent = message;
        }
        this.host.onChange();
      }
    );
  }

  public getBook(bookId: BookId): BookDefinition | null {
    return BOOKS.find((book) => book.id === bookId) ?? null;
  }

  private renderBook(book: BookDefinition): string {
    const progress = this.save.books.find((item) => item.bookId === book.id);
    if (!progress) return "";
    const percentage = Math.round((progress.hoursRead / book.hours) * 100);
    const nextMilestone = [25, 50, 75, 100].find(
      (milestone) => percentage < milestone
    );

    return `
      <article class="book-card learning-book-card ${progress.completed ? "is-complete" : ""}">
        <div class="book-cover book-cover--${book.skill}"><span>${book.title.slice(0, 1)}</span></div>
        <div class="book-card__content">
          <span>${book.author} · ${this.getSkillLabel(book.skill)}</span>
          <h3>${book.title}</h3><p>${book.description}</p><strong>${book.benefit}</strong>
          <div class="book-milestones">${[25, 50, 75, 100]
            .map(
              (milestone) =>
                `<span class="${percentage >= milestone ? "is-unlocked" : ""}">${milestone}%</span>`
            )
            .join("")}</div>
          <div class="book-progress"><i style="width:${percentage}%"></i></div>
          <small>${progress.hoursRead}/${book.hours} horas${nextMilestone ? ` · próximo desbloqueio em ${nextMilestone}%` : ""}</small>
        </div>
        <div class="book-card__actions">
          ${
            progress.completed
              ? '<b>CONHECIMENTO COMPLETO</b>'
              : `<button type="button" data-read-book="${book.id}" data-hours="2">Ler 2h</button><button type="button" class="is-secondary" data-read-book="${book.id}" data-hours="4">Ler 4h</button>`
          }
        </div>
      </article>`;
  }

  private getKnowledgePower(): number {
    return BOOKS.reduce((sum, book) => {
      const progress = this.save.books.find((item) => item.bookId === book.id);
      return sum + Math.min(1, (progress?.hoursRead ?? 0) / book.hours);
    }, 0);
  }

  private getMilestoneBenefit(book: BookDefinition, milestone: number): string {
    if (milestone === 25) return `fundamentos de ${this.getSkillLabel(book.skill)}`;
    if (milestone === 50) return "bônus parcial aplicado às próximas produções";
    if (milestone === 75) return "maior consistência e domínio da técnica";
    return "benefício permanente completo";
  }

  private getSkillLabel(skill: SkillId): string {
    return (
      {
        editing: "Edição",
        communication: "Comunicação",
        design: "Design",
        scripting: "Roteiro",
        technology: "Tecnologia",
        marketing: "Marketing"
      }[skill] ?? skill
    );
  }

  private createDefaultSave(): ReadingSave {
    return {
      books: BOOKS.map((book) => ({
        bookId: book.id,
        hoursRead: 0,
        completed: false
      })),
      completedBooks: [],
      totalReadingHours: 0
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

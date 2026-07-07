import type {
  BookId,
  PlayerState,
  ProgressionModifiers,
  ReadingSave,
  SkillId
} from "../game/types";

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
    benefit: "+5 edição e edição 5% mais rápida"
  },
  {
    id: "camera-confidence",
    title: "Fale para a Câmera",
    author: "Rafael Monte",
    description: "Presença, clareza, respiração e conexão com quem assiste.",
    hours: 20,
    skill: "communication",
    benefit: "+4 qualidade audiovisual e mais consistência"
  },
  {
    id: "click-design",
    title: "Design que Clica",
    author: "Maya Torres",
    description: "Hierarquia, contraste e leitura rápida para títulos e thumbnails.",
    hours: 16,
    skill: "design",
    benefit: "+5 em títulos e decisões visuais"
  },
  {
    id: "retention-script",
    title: "Roteiros que Prendem",
    author: "Caio Mendonça",
    description: "Promessa, gancho, progressão e recompensa narrativa.",
    hours: 22,
    skill: "scripting",
    benefit: "+5 planejamento e planejamento 5% mais rápido"
  },
  {
    id: "creator-technology",
    title: "Manual do Criador Técnico",
    author: "Nina Albuquerque",
    description: "Fluxo técnico, organização, diagnóstico e uso eficiente da máquina.",
    hours: 24,
    skill: "technology",
    benefit: "+8% em renda freelance e melhor aproveitamento técnico"
  },
  {
    id: "patient-audience",
    title: "Audiência sem Atalhos",
    author: "Victor Salles",
    description: "Catálogo, posicionamento, paciência e construção de público.",
    hours: 26,
    skill: "marketing",
    benefit: "+4 em títulos, planejamento e consistência"
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
              hoursRead: Math.max(0, Math.min(book.hours, Number(existing.hoursRead ?? 0))),
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

    progress.hoursRead = Math.min(book.hours, progress.hoursRead + hours);
    this.save.totalReadingHours += hours;
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
    return {
      error: null,
      completed: completedNow,
      message: completedNow
        ? `${book.title} concluído. Conhecimento permanente adquirido.`
        : `${hours}h lidas. Progresso: ${progress.hoursRead}/${book.hours}h.`
    };
  }

  public applyModifiers(base: ProgressionModifiers): ProgressionModifiers {
    const modifiers: ProgressionModifiers = {
      ...base,
      stageTimeMultipliers: { ...base.stageTimeMultipliers }
    };

    for (const bookId of this.save.completedBooks) {
      switch (bookId) {
        case "editing-rhythm":
          modifiers.editingBonus += 5;
          modifiers.stageTimeMultipliers.editing *= 0.95;
          break;
        case "camera-confidence":
          modifiers.audioVisualBonus += 4;
          modifiers.qualityConsistency = Math.min(
            0.98,
            modifiers.qualityConsistency + 0.035
          );
          break;
        case "click-design":
          modifiers.titleBonus += 5;
          modifiers.planningBonus += 1.5;
          break;
        case "retention-script":
          modifiers.planningBonus += 5;
          modifiers.stageTimeMultipliers.planning *= 0.95;
          break;
        case "creator-technology":
          modifiers.editingBonus += 2;
          modifiers.freelanceIncomeMultiplier += 0.08;
          break;
        case "patient-audience":
          modifiers.titleBonus += 4;
          modifiers.planningBonus += 4;
          modifiers.qualityConsistency = Math.min(
            0.98,
            modifiers.qualityConsistency + 0.025
          );
          break;
      }
    }

    modifiers.qualityCeiling = Math.min(
      99,
      modifiers.qualityCeiling + this.save.completedBooks.length * 0.8
    );
    return modifiers;
  }

  public renderLibraryHtml(message = ""): string {
    const completed = this.save.completedBooks.length;
    return `
      ${message ? `<p class="reading-message">${this.escapeHtml(message)}</p>` : ""}
      <section class="reading-summary">
        <div><span>Biblioteca</span><strong>${completed}/${BOOKS.length} livros</strong></div>
        <div><span>Tempo de leitura</span><strong>${this.save.totalReadingHours.toFixed(0)}h</strong></div>
        <div><span>Efeito</span><strong>Conhecimento permanente</strong></div>
      </section>
      <p class="reading-intro">A leitura consome tempo e energia. Ao concluir um livro, o personagem recebe um benefício permanente ligado à produção de conteúdo.</p>
      <section class="book-grid">
        ${BOOKS.map((book) => this.renderBook(book)).join("")}
      </section>
    `;
  }

  public bindLibraryEvents(
    root: HTMLElement,
    onRead: (bookId: BookId, hours: 2 | 4) => void
  ): void {
    root.querySelectorAll<HTMLButtonElement>("[data-read-book]").forEach((button) => {
      button.addEventListener("click", () => {
        const bookId = button.dataset.readBook as BookId;
        const hours = Number(button.dataset.hours) === 4 ? 4 : 2;
        onRead(bookId, hours);
      });
    });
  }

  public getBook(bookId: BookId): BookDefinition | null {
    return BOOKS.find((book) => book.id === bookId) ?? null;
  }

  private renderBook(book: BookDefinition): string {
    const progress = this.save.books.find((item) => item.bookId === book.id);
    if (!progress) return "";
    const percentage = Math.round((progress.hoursRead / book.hours) * 100);

    return `
      <article class="book-card ${progress.completed ? "is-complete" : ""}">
        <div class="book-cover book-cover--${book.skill}"><span>${book.title.slice(0, 1)}</span></div>
        <div class="book-card__content">
          <span>${book.author}</span>
          <h3>${book.title}</h3>
          <p>${book.description}</p>
          <strong>${book.benefit}</strong>
          <div class="book-progress"><i style="width:${percentage}%"></i></div>
          <small>${progress.hoursRead}/${book.hours} horas</small>
        </div>
        <div class="book-card__actions">
          ${
            progress.completed
              ? '<b>CONCLUÍDO</b>'
              : `<button type="button" data-read-book="${book.id}" data-hours="2">Ler 2h</button><button type="button" class="is-secondary" data-read-book="${book.id}" data-hours="4">Ler 4h</button>`
          }
        </div>
      </article>
    `;
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

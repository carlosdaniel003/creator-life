import "../notification-center.css";
import { ComputerTaskController } from "./ComputerTaskController";
import { CreatorLife3D } from "./CreatorLife3D";

type NotificationType = "success" | "warning" | "neutral";
type NotificationCategory =
  | "system"
  | "channel"
  | "growth"
  | "feedback"
  | "milestone";

interface NotificationInput {
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  durationMs?: number;
}

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  durationMs: number;
  createdAt: number;
  read: boolean;
}

interface ActiveNotification {
  record: NotificationRecord;
  element: HTMLElement;
  timer: number;
}

interface RuntimeLike {
  container: HTMLElement;
  openComputer?: () => void;
  closeModal?: () => void;
}

interface GrowthEventDetail {
  title?: string;
  description?: string;
  views?: number;
  subscribers?: number;
  impact?: "small" | "medium" | "large";
}

interface FeedbackDetail {
  title?: string;
  audienceFeedback?: {
    score?: number;
    headline?: string;
  };
}

const MAX_VISIBLE = 3;
const MAX_HISTORY = 80;
const MAX_PENDING = 50;
const HISTORY_KEY = "creator-life-notifications-v1";
const PATCH_FLAG = "__creatorLifeNotificationCenterPatched";

const ICONS = {
  menu: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  status: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m16 8 5-5M17 3h4v4"/>',
  opportunity: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A7 7 0 1 1 15.5 14.5C14.5 15.3 14 16.2 14 17h-4c0-.8-.5-1.7-1.5-2.5Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  college: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  channel: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
} as const;

type IconName = keyof typeof ICONS;

let runtimeInstance: RuntimeLike | null = null;
let centerInstance: NotificationCenter | null = null;

function icon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

class NotificationCenter {
  private container: HTMLElement | null = null;
  private queueElement: HTMLElement | null = null;
  private quickMenu: HTMLElement | null = null;
  private historyOverlay: HTMLElement | null = null;
  private historyList: HTMLElement | null = null;
  private pending: NotificationRecord[] = [];
  private active = new Map<string, ActiveNotification>();
  private history: NotificationRecord[] = this.loadHistory();
  private menuOpen = false;
  private historyOpen = false;
  private mountedOnce = false;
  private mountScheduled = false;

  public mount(): void {
    const container = document.getElementById("game-container");
    if (!container) {
      requestAnimationFrame(() => this.mount());
      return;
    }

    this.container = container;
    this.recoverDetachedNotifications();

    this.queueElement =
      container.querySelector<HTMLElement>(".notification-queue") ??
      this.createQueue(container);
    this.quickMenu =
      container.querySelector<HTMLElement>(".quick-action-menu") ??
      this.createQuickMenu(container);
    this.historyOverlay =
      container.querySelector<HTMLElement>(".notification-center-overlay") ??
      this.createHistoryPanel(container);
    this.historyList = this.historyOverlay.querySelector<HTMLElement>(
      ".notification-center-list"
    );

    this.bindMountedElements();
    this.renderHistory();
    this.updateBadges();
    this.updateShortcutMetadata();
    this.pump();
    this.mountedOnce = true;
  }

  public scheduleMount(): void {
    if (this.mountScheduled) return;
    this.mountScheduled = true;
    requestAnimationFrame(() => {
      this.mountScheduled = false;
      this.mount();
    });
  }

  public enqueue(input: NotificationInput): void {
    this.mount();
    const now = Date.now();
    const normalized = {
      title: input.title.trim() || "Atualização",
      message: input.message.trim(),
      type: input.type ?? "neutral",
      category: input.category ?? "system",
      durationMs: Math.max(2800, input.durationMs ?? 5200)
    };

    const recent = this.history.find(
      (item) =>
        item.title === normalized.title &&
        item.category === normalized.category &&
        now - item.createdAt <= 4200
    );

    if (recent) {
      recent.message = normalized.message;
      recent.type = normalized.type;
      recent.durationMs = normalized.durationMs;
      recent.createdAt = now;
      recent.read = false;
      this.history = [
        recent,
        ...this.history.filter((item) => item.id !== recent.id)
      ];
      const queued = this.pending.find((item) => item.id === recent.id);
      if (queued) Object.assign(queued, recent);
      const active = this.active.get(recent.id);
      if (active) this.renderCard(active.element, recent);
      this.persistHistory();
      this.renderHistory();
      this.updateBadges();
      return;
    }

    const record: NotificationRecord = {
      ...normalized,
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      read: this.historyOpen
    };

    this.history = [record, ...this.history].slice(0, MAX_HISTORY);
    this.pending.push(record);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.persistHistory();
    this.renderHistory();
    this.updateBadges();
    this.pump();
  }

  private recoverDetachedNotifications(): void {
    const queueDetached =
      this.queueElement !== null && !this.queueElement.isConnected;
    if (!queueDetached) return;

    const interrupted = [...this.active.values()].map((item) => item.record);
    this.active.forEach((item) => window.clearTimeout(item.timer));
    this.active.clear();
    this.pending = [...interrupted, ...this.pending].slice(0, MAX_PENDING);
    this.queueElement = null;
    this.quickMenu = null;
    this.historyOverlay = null;
    this.historyList = null;
  }

  private createQueue(container: HTMLElement): HTMLElement {
    const queue = document.createElement("section");
    queue.className = "notification-queue";
    queue.setAttribute("aria-label", "Notificações recentes");
    queue.setAttribute("aria-live", "polite");
    container.append(queue);
    return queue;
  }

  private createQuickMenu(container: HTMLElement): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "quick-action-menu";
    menu.innerHTML = `
      <div class="quick-action-menu__panel" role="menu" aria-label="Atalhos do jogo">
        ${this.quickAction("goals", "target", "Objetivos", "Metas e recompensas")}
        ${this.quickAction("status", "status", "Status", "Vida e habilidades")}
        ${this.quickAction("notifications", "bell", "Notificações", "Histórico recente", true)}
        ${this.quickAction("opportunities", "opportunity", "Oportunidades", "Propostas disponíveis")}
        ${this.quickAction("college", "college", "Faculdade", "Estudar e acompanhar")}
        ${this.quickAction("agenda", "agenda", "Agenda", "Contas e compromissos")}
      </div>
      <button type="button" class="quick-action-menu__launcher" aria-label="Abrir atalhos" aria-expanded="false">
        <span class="quick-action-menu__launcher-icon">${icon("menu")}</span>
        <strong>Atalhos</strong>
        <b class="quick-action-menu__badge" data-notification-badge hidden>0</b>
      </button>`;
    container.append(menu);
    return menu;
  }

  private quickAction(
    action: string,
    iconName: IconName,
    label: string,
    description: string,
    withBadge = false
  ): string {
    return `<button type="button" class="quick-action-menu__item" data-quick-action="${action}" role="menuitem"><span>${icon(iconName)}</span><span><strong>${label}</strong><small data-quick-meta="${action}">${description}</small></span>${withBadge ? '<b class="quick-action-menu__item-badge" data-notification-badge hidden>0</b>' : ""}</button>`;
  }

  private createHistoryPanel(container: HTMLElement): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "notification-center-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <aside class="notification-center-panel" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
        <header><div><span>CENTRAL</span><h2 id="notification-center-title">Notificações</h2><p>Eventos, avisos e resultados recentes da sua história.</p></div><button type="button" data-close-notification-center aria-label="Fechar">${icon("close")}</button></header>
        <div class="notification-center-toolbar"><span data-notification-summary>Nenhuma notificação</span><button type="button" data-clear-notifications>Limpar histórico</button></div>
        <div class="notification-center-list"></div>
      </aside>`;
    container.append(overlay);
    return overlay;
  }

  private bindMountedElements(): void {
    const launcher = this.quickMenu?.querySelector<HTMLButtonElement>(
      ".quick-action-menu__launcher"
    );
    if (launcher && launcher.dataset.bound !== "true") {
      launcher.dataset.bound = "true";
      launcher.addEventListener("click", () => this.setMenuOpen(!this.menuOpen));
    }

    this.quickMenu
      ?.querySelectorAll<HTMLButtonElement>("[data-quick-action]")
      .forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", () => {
          this.handleQuickAction(button.dataset.quickAction ?? "");
        });
      });

    const close = this.historyOverlay?.querySelector<HTMLButtonElement>(
      "[data-close-notification-center]"
    );
    if (close && close.dataset.bound !== "true") {
      close.dataset.bound = "true";
      close.addEventListener("click", () => this.closeHistory());
    }

    const clear = this.historyOverlay?.querySelector<HTMLButtonElement>(
      "[data-clear-notifications]"
    );
    if (clear && clear.dataset.bound !== "true") {
      clear.dataset.bound = "true";
      clear.addEventListener("click", () => this.clearHistory());
    }

    if (this.historyOverlay?.dataset.bound !== "true") {
      this.historyOverlay?.setAttribute("data-bound", "true");
      this.historyOverlay?.addEventListener("pointerdown", (event) => {
        if (event.target === this.historyOverlay) this.closeHistory();
      });
    }
  }

  private handleQuickAction(action: string): void {
    this.setMenuOpen(false);

    if (action === "notifications") {
      this.openHistory();
      return;
    }

    if (["status", "goals", "opportunities"].includes(action)) {
      const button = this.container?.querySelector<HTMLButtonElement>(
        `.creator-progress-dock [data-progress-panel="${action}"]`
      );
      if (button) button.click();
      else this.warnUnavailable("Aguarde o carregamento completo da história.");
      return;
    }

    if (action === "college" || action === "agenda") {
      this.openComputerShortcut(
        action === "college" ? "Estudar faculdade" : "Abrir agenda"
      );
    }
  }

  private openComputerShortcut(label: string): void {
    if (
      this.container?.querySelector(
        ".production-overlay.is-visible, .pause-menu-overlay.is-visible, .character-death-overlay, .computer-task-card.is-visible, .reading-task-card.is-visible"
      )
    ) {
      this.warnUnavailable(
        "Conclua ou feche a atividade atual antes de abrir este painel."
      );
      return;
    }

    if (!runtimeInstance?.openComputer) {
      this.warnUnavailable("Aguarde o carregamento completo do quarto.");
      return;
    }

    runtimeInstance.closeModal?.();
    runtimeInstance.openComputer();
    requestAnimationFrame(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>(
        "#modal-actions button"
      )].find((item) => item.textContent?.trim() === label);

      if (button) button.click();
      else {
        runtimeInstance?.closeModal?.();
        this.warnUnavailable("Abra o computador e tente novamente.");
      }
    });
  }

  private warnUnavailable(message: string): void {
    this.enqueue({
      title: "Ação indisponível",
      message,
      type: "warning",
      category: "system"
    });
  }

  private setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    this.quickMenu?.classList.toggle("is-open", open);
    const launcher = this.quickMenu?.querySelector<HTMLButtonElement>(
      ".quick-action-menu__launcher"
    );
    launcher?.setAttribute("aria-expanded", String(open));
  }

  private openHistory(): void {
    if (!this.historyOverlay) return;
    this.historyOpen = true;
    this.setMenuOpen(false);
    this.history.forEach((item) => {
      item.read = true;
    });
    this.persistHistory();
    this.updateBadges();
    this.renderHistory();
    this.historyOverlay.classList.add("is-visible");
    this.historyOverlay.setAttribute("aria-hidden", "false");
  }

  private closeHistory(): void {
    this.historyOpen = false;
    this.historyOverlay?.classList.remove("is-visible");
    this.historyOverlay?.setAttribute("aria-hidden", "true");
  }

  private clearHistory(): void {
    this.history = [];
    this.pending = [];
    this.active.forEach((item) => window.clearTimeout(item.timer));
    this.active.clear();
    this.queueElement?.replaceChildren();
    this.persistHistory();
    this.renderHistory();
    this.updateBadges();
  }

  private pump(): void {
    if (!this.queueElement?.isConnected) {
      this.scheduleMount();
      return;
    }

    while (this.active.size < MAX_VISIBLE && this.pending.length > 0) {
      const record = this.pending.shift();
      if (!record) break;
      const card = this.createCard(record);
      this.queueElement.append(card);
      requestAnimationFrame(() => card.classList.add("is-visible"));
      const timer = window.setTimeout(
        () => this.dismiss(record.id),
        record.durationMs
      );
      this.active.set(record.id, { record, element: card, timer });
    }
  }

  private createCard(record: NotificationRecord): HTMLElement {
    const card = document.createElement("article");
    card.className = "notification-card";
    card.dataset.notificationId = record.id;
    this.renderCard(card, record);
    card
      .querySelector<HTMLButtonElement>("[data-dismiss-notification]")
      ?.addEventListener("click", () => this.dismiss(record.id));
    return card;
  }

  private renderCard(card: HTMLElement, record: NotificationRecord): void {
    card.dataset.type = record.type;
    card.dataset.category = record.category;
    card.innerHTML = `
      <span class="notification-card__icon">${icon(this.iconFor(record))}</span>
      <div class="notification-card__copy"><span>${this.categoryLabel(record.category)}</span><strong>${escapeHtml(record.title)}</strong><p>${escapeHtml(record.message)}</p></div>
      <button type="button" class="notification-card__dismiss" data-dismiss-notification aria-label="Dispensar notificação">${icon("close")}</button>`;
  }

  private dismiss(id: string): void {
    const active = this.active.get(id);
    if (!active) return;
    window.clearTimeout(active.timer);
    active.element.classList.add("is-leaving");
    active.element.classList.remove("is-visible");
    window.setTimeout(() => {
      active.element.remove();
      this.active.delete(id);
      this.pump();
    }, 230);
  }

  private renderHistory(): void {
    if (!this.historyList || !this.historyOverlay) return;
    const summary = this.historyOverlay.querySelector<HTMLElement>(
      "[data-notification-summary]"
    );
    if (summary) {
      summary.textContent = this.history.length
        ? `${this.history.length} registro${this.history.length === 1 ? "" : "s"}`
        : "Nenhuma notificação";
    }

    this.historyList.innerHTML = this.history.length
      ? this.history
          .map(
            (item) => `
          <article class="notification-history-item" data-type="${item.type}">
            <span>${icon(this.iconFor(item))}</span>
            <div><small>${this.categoryLabel(item.category)} · ${formatTime(item.createdAt)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div>
          </article>`
          )
          .join("")
      : `<div class="notification-history-empty">${icon("bell")}<strong>Nenhuma notificação registrada</strong><p>Eventos, resultados de ações e avisos aparecerão aqui.</p></div>`;
  }

  private updateShortcutMetadata(): void {
    const mappings: Array<[string, string, string]> = [
      ["goals", "progress-goal-count", "Metas e recompensas"],
      ["opportunities", "progress-opportunity-count", "Propostas disponíveis"],
      ["status", "progress-status-level", "Vida e habilidades"]
    ];

    mappings.forEach(([action, sourceId, fallback]) => {
      const target = this.quickMenu?.querySelector<HTMLElement>(
        `[data-quick-meta="${action}"]`
      );
      const source = document.getElementById(sourceId);
      if (target) target.textContent = source?.textContent?.trim() || fallback;
    });
  }

  private updateBadges(): void {
    const unread = this.history.filter((item) => !item.read).length;
    this.quickMenu
      ?.querySelectorAll<HTMLElement>("[data-notification-badge]")
      .forEach((badge) => {
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.hidden = unread === 0;
      });
  }

  private iconFor(record: Pick<NotificationRecord, "type" | "category">): IconName {
    if (record.type === "warning") return "warning";
    if (record.category === "channel" || record.category === "growth") {
      return "channel";
    }
    if (record.category === "feedback") return "status";
    if (record.type === "success" || record.category === "milestone") {
      return "check";
    }
    return "info";
  }

  private categoryLabel(category: NotificationCategory): string {
    const labels: Record<NotificationCategory, string> = {
      system: "SISTEMA",
      channel: "CANAL",
      growth: "CRESCIMENTO",
      feedback: "INSIGHT DO PÚBLICO",
      milestone: "CONQUISTA"
    };
    return labels[category];
  }

  private loadHistory(): NotificationRecord[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as NotificationRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.message === "string"
        )
        .slice(0, MAX_HISTORY)
        .map((item) => ({
          ...item,
          type: isNotificationType(item.type) ? item.type : "neutral",
          category: isNotificationCategory(item.category)
            ? item.category
            : "system",
          durationMs: Number.isFinite(item.durationMs) ? item.durationMs : 5200,
          createdAt: Number.isFinite(item.createdAt)
            ? item.createdAt
            : Date.now(),
          read: Boolean(item.read)
        }));
    } catch {
      return [];
    }
  }

  private persistHistory(): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // A interface continua funcionando quando o armazenamento é bloqueado.
    }
  }
}

function getCenter(): NotificationCenter {
  if (!centerInstance) centerInstance = new NotificationCenter();
  return centerInstance;
}

function patchRuntime(): void {
  const prototype = CreatorLife3D.prototype as any;
  if (prototype[PATCH_FLAG]) return;
  prototype[PATCH_FLAG] = true;

  const originalInjectInterface = prototype.injectInterface;
  prototype.injectInterface = function (): void {
    runtimeInstance = this as RuntimeLike;
    originalInjectInterface.call(this);
    getCenter().scheduleMount();
  };

  prototype.showToast = function (
    message: string,
    type: NotificationType
  ): void {
    getCenter().enqueue({
      title:
        type === "warning"
          ? "Atenção"
          : type === "success"
            ? "Concluído"
            : "Atualização",
      message,
      type,
      category: "system"
    });
  };
}

function patchComputerMessages(): void {
  const prototype = ComputerTaskController.prototype as any;
  if (prototype.__notificationCenterMessagePatched) return;
  prototype.__notificationCenterMessagePatched = true;

  prototype.showMessage = function (
    title: string,
    detail: string,
    type: "gain" | "published" | "milestone"
  ): void {
    getCenter().enqueue({
      title,
      message: detail,
      type: type === "gain" ? "neutral" : "success",
      category:
        type === "gain"
          ? "channel"
          : type === "milestone"
            ? "milestone"
            : "channel",
      durationMs: type === "gain" ? 4400 : 5800
    });
  };
}

function installEventRouting(): void {
  document.addEventListener(
    "creator-life-growth-event",
    (event) => {
      const detail = (event as CustomEvent<GrowthEventDetail>).detail;
      if (!detail) return;
      event.stopImmediatePropagation();
      getCenter().enqueue({
        title: detail.title ?? "Novo evento de crescimento",
        message: `+${Number(detail.views ?? 0).toLocaleString("pt-BR")} views · +${Number(detail.subscribers ?? 0).toLocaleString("pt-BR")} inscritos${detail.description ? ` · ${detail.description}` : ""}`,
        type: detail.impact === "large" ? "success" : "neutral",
        category: "growth",
        durationMs: detail.impact === "large" ? 6200 : 5200
      });
    },
    true
  );

  document.addEventListener(
    "creator-life-feedback-ready",
    (event) => {
      const video = (event as CustomEvent<FeedbackDetail>).detail;
      const feedback = video?.audienceFeedback;
      if (!video || !feedback) return;
      event.stopImmediatePropagation();
      const score = Number(feedback.score ?? 0);
      getCenter().enqueue({
        title: `Novo insight: ${video.title ?? "vídeo publicado"}`,
        message: `O público atribuiu nota ${score}/100${feedback.headline ? `. ${feedback.headline}` : "."}`,
        type: score >= 64 ? "success" : score < 48 ? "warning" : "neutral",
        category: "feedback",
        durationMs: 6000
      });
    },
    true
  );
}

function installMountObserver(): void {
  const start = (): void => {
    const container = document.getElementById("game-container");
    if (!container) {
      requestAnimationFrame(start);
      return;
    }

    const observer = new MutationObserver(() => {
      getCenter().scheduleMount();
    });
    observer.observe(container, { childList: true, subtree: false });
    getCenter().mount();
  };
  start();
}

function installGlobalDismissals(): void {
  document.addEventListener("pointerdown", (event) => {
    const menu = document.querySelector<HTMLElement>(".quick-action-menu");
    if (!menu?.classList.contains("is-open")) return;
    const target = event.target as Node | null;
    if (target && menu.contains(target)) return;
    menu.classList.remove("is-open");
  });
}

function isNotificationType(value: unknown): value is NotificationType {
  return value === "success" || value === "warning" || value === "neutral";
}

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return ["system", "channel", "growth", "feedback", "milestone"].includes(
    String(value)
  );
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

patchRuntime();
patchComputerMessages();
installEventRouting();
installGlobalDismissals();
installMountObserver();

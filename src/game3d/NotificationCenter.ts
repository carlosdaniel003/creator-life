import type { ChannelGain } from "../game/types";
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

interface NotificationRecord extends Required<NotificationInput> {
  id: string;
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
  modalOpen?: boolean;
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

let runtimeInstance: RuntimeLike | null = null;
let centerInstance: NotificationCenter | null = null;

const SVG_ICONS = {
  menu: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  status: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m16 8 5-5M17 3h4v4"/>',
  opportunity: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A7 7 0 1 1 15.5 14.5C14.5 15.3 14 16.2 14 17h-4c0-.8-.5-1.7-1.5-2.5Z"/><path d="m12 7 1.2 2.4L16 10l-2 2 .5 2.8-2.5-1.3-2.5 1.3L10 12l-2-2 2.8-.6L12 7Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  college: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  channel: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
} as const;

type SvgIconName = keyof typeof SVG_ICONS;

function svg(name: SvgIconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SVG_ICONS[name]}</svg>`;
}

class NotificationCenter {
  private container: HTMLElement | null = null;
  private queueElement: HTMLElement | null = null;
  private quickMenu: HTMLElement | null = null;
  private quickMenuPanel: HTMLElement | null = null;
  private historyOverlay: HTMLElement | null = null;
  private historyList: HTMLElement | null = null;
  private pending: NotificationRecord[] = [];
  private active = new Map<string, ActiveNotification>();
  private history: NotificationRecord[] = this.loadHistory();
  private menuOpen = false;
  private historyOpen = false;
  private toastObserver: MutationObserver | null = null;
  private uiObserver: MutationObserver | null = null;
  private updateScheduled = false;

  public install(): void {
    const container = document.getElementById("game-container");
    if (!container) {
      requestAnimationFrame(() => this.install());
      return;
    }
    if (this.container === container) return;

    this.container = container;
    this.createQueue();
    this.createQuickMenu();
    this.createHistoryPanel();
    this.observeLegacyToast();
    this.observeHudChanges();
    this.bindGlobalEvents();
    this.updateBadges();
  }

  public enqueue(input: NotificationInput): void {
    this.install();
    const now = Date.now();
    const normalized: Required<NotificationInput> = {
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
      this.moveHistoryToTop(recent);
      const queued = this.pending.find((item) => item.id === recent.id);
      if (queued) Object.assign(queued, recent);
      const active = this.active.get(recent.id);
      if (active) this.updateCard(active.element, recent);
      this.persistHistory();
      this.updateBadges();
      this.renderHistory();
      return;
    }

    const record: NotificationRecord = {
      ...normalized,
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      read: this.historyOpen
    };

    this.history.unshift(record);
    this.history = this.history.slice(0, MAX_HISTORY);
    this.pending.push(record);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.persistHistory();
    this.updateBadges();
    this.renderHistory();
    this.pump();
  }

  public openHistory(): void {
    this.install();
    if (!this.historyOverlay) return;
    this.historyOpen = true;
    this.menuOpen = false;
    this.quickMenu?.classList.remove("is-open");
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
    if (!this.historyOverlay) return;
    this.historyOpen = false;
    this.historyOverlay.classList.remove("is-visible");
    this.historyOverlay.setAttribute("aria-hidden", "true");
  }

  private createQueue(): void {
    if (!this.container || this.queueElement) return;
    const queue = document.createElement("section");
    queue.className = "notification-queue";
    queue.setAttribute("aria-label", "Notificações recentes");
    queue.setAttribute("aria-live", "polite");
    this.container.append(queue);
    this.queueElement = queue;
  }

  private createQuickMenu(): void {
    if (!this.container || this.quickMenu) return;
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
        <span class="quick-action-menu__launcher-icon">${svg("menu")}</span>
        <strong>Atalhos</strong>
        <b class="quick-action-menu__badge" data-notification-badge hidden>0</b>
      </button>`;
    this.container.append(menu);
    this.quickMenu = menu;
    this.quickMenuPanel = menu.querySelector(".quick-action-menu__panel");

    menu
      .querySelector<HTMLButtonElement>(".quick-action-menu__launcher")
      ?.addEventListener("click", () => this.toggleMenu());
    menu.querySelectorAll<HTMLButtonElement>("[data-quick-action]").forEach((button) => {
      button.addEventListener("click", () => {
        this.handleQuickAction(button.dataset.quickAction ?? "");
      });
    });
  }

  private quickAction(
    action: string,
    iconName: SvgIconName,
    label: string,
    description: string,
    withBadge = false
  ): string {
    return `<button type="button" class="quick-action-menu__item" data-quick-action="${action}" role="menuitem"><span>${svg(iconName)}</span><span><strong>${label}</strong><small data-quick-meta="${action}">${description}</small></span>${withBadge ? '<b class="quick-action-menu__item-badge" data-notification-badge hidden>0</b>' : ""}</button>`;
  }

  private createHistoryPanel(): void {
    if (!this.container || this.historyOverlay) return;
    const overlay = document.createElement("div");
    overlay.className = "notification-center-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <aside class="notification-center-panel" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
        <header><div><span>CENTRAL</span><h2 id="notification-center-title">Notificações</h2><p>Eventos, avisos e resultados recentes da sua história.</p></div><button type="button" data-close-notification-center aria-label="Fechar">${svg("close")}</button></header>
        <div class="notification-center-toolbar"><span data-notification-summary>Nenhuma notificação</span><button type="button" data-clear-notifications>Limpar histórico</button></div>
        <div class="notification-center-list"></div>
      </aside>`;
    this.container.append(overlay);
    this.historyOverlay = overlay;
    this.historyList = overlay.querySelector(".notification-center-list");

    overlay.addEventListener("pointerdown", (event) => {
      const target = event.target as Element | null;
      if (event.target === overlay || target?.closest("[data-close-notification-center]")) {
        this.closeHistory();
      }
    });
    overlay
      .querySelector<HTMLButtonElement>("[data-clear-notifications]")
      ?.addEventListener("click", () => {
        this.history = [];
        this.pending = [];
        this.active.forEach((item) => window.clearTimeout(item.timer));
        this.active.clear();
        this.queueElement?.replaceChildren();
        this.persistHistory();
        this.updateBadges();
        this.renderHistory();
      });
    this.renderHistory();
  }

  private bindGlobalEvents(): void {
    document.addEventListener("pointerdown", (event) => {
      if (!this.menuOpen || !this.quickMenu) return;
      const target = event.target as Node | null;
      if (target && this.quickMenu.contains(target)) return;
      this.setMenuOpen(false);
    });

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") return;
        if (this.historyOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.closeHistory();
        } else if (this.menuOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.setMenuOpen(false);
        }
      },
      true
    );
  }

  private toggleMenu(): void {
    this.setMenuOpen(!this.menuOpen);
  }

  private setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    this.quickMenu?.classList.toggle("is-open", open);
    const launcher = this.quickMenu?.querySelector<HTMLButtonElement>(
      ".quick-action-menu__launcher"
    );
    launcher?.setAttribute("aria-expanded", String(open));
    launcher?.setAttribute("aria-label", open ? "Fechar atalhos" : "Abrir atalhos");
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
      else {
        this.enqueue({
          title: "Painel indisponível",
          message: "Aguarde o carregamento completo da história.",
          type: "warning"
        });
      }
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
      this.enqueue({
        title: "Ação indisponível",
        message: "Conclua ou feche a atividade atual antes de abrir este painel.",
        type: "warning"
      });
      return;
    }

    const runtime = runtimeInstance;
    if (!runtime?.openComputer) {
      this.enqueue({
        title: "Computador indisponível",
        message: "Aguarde o carregamento completo do quarto.",
        type: "warning"
      });
      return;
    }

    runtime.closeModal?.();
    runtime.openComputer();
    requestAnimationFrame(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("#modal-actions button")].find(
        (item) => item.textContent?.trim() === label
      );
      if (button) button.click();
      else {
        runtime.closeModal?.();
        this.enqueue({
          title: "Atalho não encontrado",
          message: "Abra o computador e tente novamente.",
          type: "warning"
        });
      }
    });
  }

  private pump(): void {
    if (!this.queueElement) return;
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
    card.dataset.type = record.type;
    card.dataset.category = record.category;
    card.dataset.notificationId = record.id;
    this.updateCard(card, record);
    card
      .querySelector<HTMLButtonElement>("[data-dismiss-notification]")
      ?.addEventListener("click", () => this.dismiss(record.id));
    return card;
  }

  private updateCard(card: HTMLElement, record: NotificationRecord): void {
    const iconName = this.iconFor(record);
    card.dataset.type = record.type;
    card.dataset.category = record.category;
    card.innerHTML = `
      <span class="notification-card__icon">${svg(iconName)}</span>
      <div class="notification-card__copy"><span>${this.categoryLabel(record.category)}</span><strong>${escapeHtml(record.title)}</strong><p>${escapeHtml(record.message)}</p></div>
      <button type="button" class="notification-card__dismiss" data-dismiss-notification aria-label="Dispensar notificação">${svg("close")}</button>`;
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
            <span>${svg(this.iconFor(item))}</span>
            <div><small>${this.categoryLabel(item.category)} · ${formatTime(item.createdAt)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div>
          </article>`
          )
          .join("")
      : `<div class="notification-history-empty">${svg("bell")}<strong>Nenhuma notificação registrada</strong><p>Eventos, resultados de ações e avisos aparecerão aqui.</p></div>`;
  }

  private observeLegacyToast(): void {
    const toast = this.container?.querySelector<HTMLElement>(".game-toast");
    if (!toast || this.toastObserver) return;

    const route = (): void => {
      if (!toast.classList.contains("is-visible")) return;
      const message = toast.textContent?.trim();
      if (!message) return;
      const type = isNotificationType(toast.dataset.type)
        ? toast.dataset.type
        : "neutral";
      toast.classList.remove("is-visible");
      this.enqueue({
        title: type === "warning" ? "Atenção" : type === "success" ? "Concluído" : "Atualização",
        message,
        type,
        category: "system"
      });
    };

    this.toastObserver = new MutationObserver(route);
    this.toastObserver.observe(toast, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  private observeHudChanges(): void {
    if (!this.container || this.uiObserver) return;
    this.uiObserver = new MutationObserver(() => {
      if (this.updateScheduled) return;
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.updateScheduled = false;
        this.updateShortcutMetadata();
        this.observeLegacyToast();
      });
    });
    this.uiObserver.observe(this.container, {
      childList: true,
      subtree: true,
      characterData: true
    });
    this.updateShortcutMetadata();
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

  private iconFor(record: Pick<NotificationRecord, "type" | "category">): SvgIconName {
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

  private moveHistoryToTop(record: NotificationRecord): void {
    this.history = [record, ...this.history.filter((item) => item.id !== record.id)];
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
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
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
      // A fila continua funcionando mesmo quando o armazenamento é bloqueado.
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
    getCenter().install();
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

function formatGain(gain: ChannelGain): string {
  return [
    gain.views > 0 ? `+${gain.views.toLocaleString("pt-BR")} views` : "",
    gain.likes > 0 ? `+${gain.likes.toLocaleString("pt-BR")} likes` : "",
    gain.subscribers > 0
      ? `+${gain.subscribers.toLocaleString("pt-BR")} inscritos`
      : "",
    gain.revenue >= 0.01 ? `+R$ ${gain.revenue.toFixed(2)}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

void formatGain;

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
getCenter().install();

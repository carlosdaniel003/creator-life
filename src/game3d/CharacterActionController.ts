import * as THREE from "three";

import type { PlayerState } from "../game/types";
import "../character-actions.css";
import type { PlayerAvatar } from "./PlayerAvatar";

interface ModalAction {
  label: string;
  action: () => void;
  secondary?: boolean;
}

interface CharacterActionRuntime {
  container: HTMLElement;
  camera: THREE.OrthographicCamera;
  player: PlayerAvatar;
  state: PlayerState & { thirst?: number };
  modalOpen: boolean;
  keys: Set<string>;
  showModal: (title: string, body: string, actions: ModalAction[]) => void;
  closeModal: () => void;
  showToast: (
    message: string,
    type: "success" | "warning" | "neutral"
  ) => void;
  advanceTime: (hours: number) => void;
}

interface TimedActionOptions {
  title: string;
  detail: string;
  icon: string;
  hours: number;
  durationMs: number;
  anchor: THREE.Vector3;
  advanceTime: (hours: number) => void;
  updatePose: (time: number) => void;
  onComplete: () => void;
}

interface HomeActionOptions {
  type: "sleep" | "meal" | "water" | "study";
  hours: number;
  advanceTime: (hours: number) => void;
  onComplete: () => void;
}

interface FreelanceActionOptions {
  hours: number;
  advanceTime: (hours: number) => void;
  onComplete: () => void;
}

const ACTION_CONFIG = {
  sleep: {
    title: "Dormindo",
    detail: "Recuperando energia e criatividade",
    icon: "☾",
    durationMs: 5600,
    anchor: new THREE.Vector3(-4.15, 2.55, -2.35)
  },
  meal: {
    title: "Fazendo uma refeição",
    detail: "Comendo e recuperando a fome",
    icon: "●",
    durationMs: 2700,
    anchor: new THREE.Vector3(4.2, 2.7, 2.65)
  },
  water: {
    title: "Bebendo água",
    detail: "Recuperando a hidratação",
    icon: "◒",
    durationMs: 2100,
    anchor: new THREE.Vector3(4.2, 2.7, 2.65)
  },
  study: {
    title: "Estudando para a faculdade",
    detail: "Lendo, revisando e fazendo anotações",
    icon: "✎",
    durationMs: 3600,
    anchor: new THREE.Vector3(2.9, 2.85, -3.45)
  }
} as const;

export class CharacterActionController {
  private readonly layer: HTMLElement;
  private readonly card: HTMLElement;
  private anchor = new THREE.Vector3();
  private active = false;
  private modalIntegrationInstalled = false;

  public constructor(private readonly runtime: CharacterActionRuntime) {
    this.layer = document.createElement("div");
    this.layer.className = "character-action-world-layer";
    this.layer.innerHTML = `
      <section class="character-action-card" aria-live="polite">
        <div class="character-action-card__header">
          <span class="character-action-card__icon" id="character-action-icon">●</span>
          <div><small id="character-action-eyebrow">AÇÃO EM ANDAMENTO</small><strong id="character-action-title">Atividade</strong></div>
        </div>
        <p id="character-action-detail">Executando atividade</p>
        <div class="character-action-card__progress"><div id="character-action-progress"></div></div>
        <div class="character-action-card__meta">
          <span id="character-action-hours">1 hora no jogo</span>
          <strong id="character-action-time">08:00</strong>
        </div>
      </section>
    `;
    this.runtime.container.append(this.layer);
    this.card = this.requireElement(".character-action-card");
    this.updateWorldLayer();
  }

  public installModalActionAnimations(): void {
    if (this.modalIntegrationInstalled) return;
    this.modalIntegrationInstalled = true;

    const originalShowModal = this.runtime.showModal.bind(this.runtime);
    this.runtime.showModal = (title, body, actions) => {
      originalShowModal(
        title,
        body,
        actions.map((action) => ({
          ...action,
          action: this.decorateAction(action)
        }))
      );
    };
  }

  public isActive(): boolean {
    return this.active;
  }

  public async runHomeAction(options: HomeActionOptions): Promise<void> {
    if (this.active) return;
    this.beginAction();

    try {
      if (options.type === "sleep") {
        await this.runtime.player.walkTo(-2.55, -1.1, 1050);
        this.runtime.player.setPosition(-4.15, -2.35);
        this.runtime.player.setSleepingPose(true);
      } else if (options.type === "study") {
        await this.runtime.player.walkTo(2.9, -1.86, 1000);
        this.runtime.player.setPosition(2.9, -2.18);
        this.runtime.player.setStudyPose(true);
      } else {
        await this.runtime.player.walkTo(4.02, 2.7, 950);
        this.runtime.player.setMealPose(
          options.type === "meal" ? "meal" : "water"
        );
      }

      const config = ACTION_CONFIG[options.type];
      await this.runTimedAction({
        title: config.title,
        detail: config.detail,
        icon: config.icon,
        hours: options.hours,
        durationMs:
          options.type === "study" && options.hours >= 4
            ? 5400
            : config.durationMs,
        anchor: config.anchor,
        advanceTime: options.advanceTime,
        updatePose: (time) => {
          if (options.type === "sleep") {
            this.runtime.player.updateSleepAnimation(time);
          } else if (options.type === "study") {
            this.runtime.player.updateStudyAnimation(time);
          } else {
            this.runtime.player.updateMealAnimation(time);
          }
        },
        onComplete: options.onComplete
      });

      if (options.type === "sleep") {
        this.runtime.player.setSleepingPose(false);
        this.runtime.player.setPosition(-2.55, -1.1);
      } else if (options.type === "study") {
        this.runtime.player.setStudyPose(false);
        this.runtime.player.setPosition(2.9, -1.86);
      } else {
        this.runtime.player.setMealPose(null);
        this.runtime.player.setPosition(3.92, 2.5);
      }
    } finally {
      this.finishAction();
    }
  }

  public async runFreelance(options: FreelanceActionOptions): Promise<void> {
    if (this.active) return;
    this.beginAction();

    try {
      await this.runtime.player.walkTo(-5.05, 0.05, 1250);
      this.anchor.set(-5.15, 2.8, 0.05);
      this.configureCard(
        "Trabalho freelance",
        "O personagem saiu para atender um cliente",
        "↗",
        options.hours,
        "FORA DE CASA"
      );
      this.card.classList.add("is-visible", "is-away");

      await this.fadePlayer(false);
      this.runtime.player.setVisible(false);

      await this.animateProgress({
        hours: options.hours,
        durationMs: 5700,
        updatePose: () => undefined
      });

      options.advanceTime(options.hours);
      options.onComplete();
      this.runtime.player.setPosition(-5.05, 0.05);
      this.runtime.player.setVisible(true);
      await this.fadePlayer(true);
      this.card.classList.remove("is-visible", "is-away");
      await this.runtime.player.walkTo(-4.25, 0.15, 800);
    } finally {
      this.finishAction();
    }
  }

  private decorateAction(action: ModalAction): () => void {
    const label = action.label.toLocaleLowerCase("pt-BR");

    if (label === "dormir 7 horas") {
      return () => {
        this.runtime.closeModal();
        void this.runHomeAction({
          type: "sleep",
          hours: 7,
          advanceTime: () => undefined,
          onComplete: action.action
        });
      };
    }

    if (label === "comprar refeição") {
      return () => {
        if (this.runtime.state.money < 14) {
          action.action();
          return;
        }
        this.runtime.closeModal();
        void this.runHomeAction({
          type: "meal",
          hours: 1,
          advanceTime: () => undefined,
          onComplete: action.action
        });
      };
    }

    if (label === "comprar água") {
      return () => {
        if (this.runtime.state.money < 3) {
          action.action();
          return;
        }
        this.runtime.closeModal();
        void this.runHomeAction({
          type: "water",
          hours: 1,
          advanceTime: () => undefined,
          onComplete: action.action
        });
      };
    }

    const studyMatch = label.match(/^estudar (2|4) horas$/);
    if (studyMatch) {
      const hours = Number(studyMatch[1]) as 2 | 4;
      return () => this.runDeferredStudy(action, hours);
    }

    if (label === "aceitar trabalho") {
      return () => this.runDeferredFreelance(action);
    }

    return action.action;
  }

  private runDeferredStudy(action: ModalAction, hours: 2 | 4): void {
    const energyCost = hours === 4 ? 22 : 10;
    const thirst = this.runtime.state.thirst ?? 100;
    if (
      this.runtime.state.energy < energyCost ||
      this.runtime.state.hunger < 12 ||
      thirst < 12
    ) {
      action.action();
      return;
    }

    const deferred = this.executeWithDeferredTime(action.action);
    if (deferred.hours <= 0) return;

    void this.runHomeAction({
      type: "study",
      hours,
      advanceTime: deferred.advance,
      onComplete: deferred.flushToasts
    });
  }

  private runDeferredFreelance(action: ModalAction): void {
    const deferred = this.executeWithDeferredTime(action.action);
    if (deferred.hours <= 0) return;

    void this.runFreelance({
      hours: deferred.hours,
      advanceTime: deferred.advance,
      onComplete: deferred.flushToasts
    });
  }

  private executeWithDeferredTime(action: () => void): {
    hours: number;
    advance: (hours: number) => void;
    flushToasts: () => void;
  } {
    const runtime = this.runtime;
    const originalAdvance = runtime.advanceTime;
    const originalToast = runtime.showToast;
    const queuedToasts: Array<{
      message: string;
      type: "success" | "warning" | "neutral";
    }> = [];
    let deferredHours = 0;

    runtime.advanceTime = (hours) => {
      deferredHours += Math.max(0, hours);
    };
    runtime.showToast = (message, type) => {
      queuedToasts.push({ message, type });
    };

    try {
      action();
    } finally {
      runtime.advanceTime = originalAdvance;
      runtime.showToast = originalToast;
    }

    if (deferredHours > 0) {
      runtime.closeModal();
    } else {
      queuedToasts.forEach((toast) => originalToast(toast.message, toast.type));
    }

    return {
      hours: deferredHours,
      advance: (hours) => originalAdvance.call(runtime, hours),
      flushToasts: () => {
        queuedToasts.forEach((toast) => originalToast(toast.message, toast.type));
      }
    };
  }

  private async runTimedAction(options: TimedActionOptions): Promise<void> {
    this.anchor.copy(options.anchor);
    this.configureCard(
      options.title,
      options.detail,
      options.icon,
      options.hours,
      "AÇÃO EM ANDAMENTO"
    );
    this.card.classList.add("is-visible");

    await this.animateProgress({
      hours: options.hours,
      durationMs: options.durationMs,
      updatePose: options.updatePose
    });

    options.advanceTime(options.hours);
    options.onComplete();
    this.card.classList.remove("is-visible");
  }

  private animateProgress(options: {
    hours: number;
    durationMs: number;
    updatePose: (time: number) => void;
  }): Promise<void> {
    const progressBar = this.requireElement("#character-action-progress");
    const time = this.requireElement("#character-action-time");
    const hudTime = document.getElementById("hud-time");
    const startingHour = this.runtime.state.hour;
    progressBar.style.width = "0%";

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const update = (now: number): void => {
        const progress = Math.min(1, (now - startedAt) / options.durationMs);
        const previewHour = startingHour + options.hours * progress;
        const formatted = this.formatHour(previewHour);

        progressBar.style.width = `${Math.round(progress * 100)}%`;
        time.textContent = formatted;
        if (hudTime) hudTime.textContent = formatted;
        options.updatePose(now / 1000);
        this.previewWorld(previewHour);

        if (progress < 1) requestAnimationFrame(update);
        else resolve();
      };
      requestAnimationFrame(update);
    });
  }

  private configureCard(
    title: string,
    detail: string,
    icon: string,
    hours: number,
    eyebrow: string
  ): void {
    this.requireElement("#character-action-eyebrow").textContent = eyebrow;
    this.requireElement("#character-action-title").textContent = title;
    this.requireElement("#character-action-detail").textContent = detail;
    this.requireElement("#character-action-icon").textContent = icon;
    this.requireElement("#character-action-hours").textContent = `${hours} hora${
      hours === 1 ? "" : "s"
    } no jogo`;
  }

  private beginAction(): void {
    this.active = true;
    this.runtime.modalOpen = true;
    this.runtime.keys.clear();
    this.runtime.container.classList.add("is-character-busy");
  }

  private finishAction(): void {
    this.card.classList.remove("is-visible", "is-away");
    this.runtime.player.setVisible(true);
    this.runtime.modalOpen = false;
    this.runtime.container.classList.remove("is-character-busy");
    this.active = false;
    this.runtime.container.dispatchEvent(
      new CustomEvent("creator-life-action-complete")
    );
  }

  private previewWorld(hour: number): void {
    this.runtime.container.dispatchEvent(
      new CustomEvent("creator-life-preview-time", {
        detail: { hour }
      })
    );
  }

  private fadePlayer(visible: boolean): Promise<void> {
    const duration = 380;
    const start = visible ? 0 : 1;
    const end = visible ? 1 : 0;

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const materials: THREE.Material[] = [];
      this.runtime.player.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const meshMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        meshMaterials.forEach((material) => {
          material.transparent = true;
          materials.push(material);
        });
      });

      const update = (now: number): void => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const opacity = THREE.MathUtils.lerp(start, end, progress);
        materials.forEach((material) => {
          material.opacity = opacity;
        });
        this.runtime.player.group.scale.setScalar(
          THREE.MathUtils.lerp(visible ? 0.92 : 1, visible ? 1 : 0.92, progress)
        );

        if (progress < 1) requestAnimationFrame(update);
        else {
          materials.forEach((material) => {
            material.opacity = 1;
          });
          this.runtime.player.group.scale.setScalar(1);
          resolve();
        }
      };
      requestAnimationFrame(update);
    });
  }

  private updateWorldLayer(): void {
    const projected = this.anchor.clone().project(this.runtime.camera);
    const width = this.runtime.container.clientWidth;
    const height = this.runtime.container.clientHeight;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    this.layer.style.left = `${x}px`;
    this.layer.style.top = `${y}px`;
    requestAnimationFrame(() => this.updateWorldLayer());
  }

  private formatHour(value: number): string {
    const normalized = ((value % 24) + 24) % 24;
    const hour = Math.floor(normalized);
    const minute = Math.floor((normalized - hour) * 60);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  private requireElement<T extends HTMLElement = HTMLElement>(
    selector: string
  ): T {
    const element = this.layer.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Elemento de ação não encontrado: ${selector}`);
    }
    return element;
  }
}

import * as THREE from "three";

import type { ChannelGain, PlayerState } from "../game/types";
import { CharacterActionController } from "./CharacterActionController";
import type { ProductionStage } from "./VideoProductionModel";
import type { PlayerAvatar } from "./PlayerAvatar";

interface RuntimeModalAction {
  label: string;
  action: () => void;
  secondary?: boolean;
}

interface GameRuntime3D {
  container: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  player: PlayerAvatar;
  state: PlayerState & { thirst?: number };
  modalOpen: boolean;
  keys: Set<string>;
  showModal: (
    title: string,
    body: string,
    actions: RuntimeModalAction[]
  ) => void;
  closeModal: () => void;
  showToast: (
    message: string,
    type: "success" | "warning" | "neutral"
  ) => void;
  advanceTime: (hours: number) => void;
}

interface TaskStage {
  label: string;
  hours: number;
  durationMs: number;
}

export interface ComputerActivityOptions {
  title: string;
  detail: string;
  hours: number;
  durationMs?: number;
  eyebrow?: string;
  icon?: string;
  progressLabel?: string;
  completionTitle?: string;
  completionDetail?: string;
  onComplete: () => void | Promise<void>;
}

declare global {
  interface Window {
    __creatorLifeComputerTask?: {
      runActivity: (options: ComputerActivityOptions) => Promise<boolean>;
      isActive: () => boolean;
    };
  }
}

export class ComputerTaskController {
  private readonly worldLayer: HTMLElement;
  private readonly taskCard: HTMLElement;
  private readonly gainStack: HTMLElement;
  private readonly anchor = new THREE.Vector3(2.9, 2.85, -3.45);
  private active = false;

  public constructor(private readonly runtime: GameRuntime3D) {
    const characterActions = new CharacterActionController(runtime);
    characterActions.installModalActionAnimations();

    this.worldLayer = document.createElement("div");
    this.worldLayer.className = "computer-world-layer";
    this.worldLayer.innerHTML = `
      <section class="computer-task-card" aria-live="polite">
        <div class="computer-task-card__header">
          <span class="computer-task-card__icon" id="computer-task-icon">▶</span>
          <div><small id="computer-task-eyebrow">PRODUÇÃO EM ANDAMENTO</small><strong id="computer-task-label">Planejando</strong></div>
        </div>
        <div class="computer-task-card__progress"><div id="computer-task-progress"></div></div>
        <div class="computer-task-card__meta">
          <span id="computer-task-step">Etapa 1 de 4</span>
          <strong id="computer-task-time">08:00</strong>
        </div>
      </section>
      <div class="computer-gain-stack" aria-live="polite"></div>
    `;
    this.runtime.container.append(this.worldLayer);

    this.taskCard = this.requireElement(".computer-task-card");
    this.gainStack = this.requireElement(".computer-gain-stack");
    this.applyYouTubePalette();
    this.updateWorldLayer();

    window.__creatorLifeComputerTask = {
      runActivity: (options) => this.runActivity(options),
      isActive: () => this.active
    };
  }

  public async runProduction(
    stages: ProductionStage[],
    advanceStage: (hours: number) => void,
    onPublished: () => void
  ): Promise<void> {
    if (this.active) return;
    this.beginTask("PRODUÇÃO EM ANDAMENTO", "▶");

    try {
      await this.moveToComputer();
      for (let index = 0; index < stages.length; index += 1) {
        const stage = stages[index];
        await this.animateStage(stage, `Etapa ${index + 1} de ${stages.length}`);
        advanceStage(stage.hours);
      }
      onPublished();
      this.showMessage(
        "Vídeo publicado",
        "O upload terminou e o vídeo já está no canal.",
        "published"
      );
    } finally {
      this.finishTask();
    }
  }

  public async runActivity(
    options: ComputerActivityOptions
  ): Promise<boolean> {
    if (this.active) return false;

    const hours = Number.isFinite(options.hours)
      ? Math.max(0.25, options.hours)
      : 1;
    const durationMs = Number.isFinite(options.durationMs)
      ? Math.max(1200, Number(options.durationMs))
      : Math.min(6200, 2200 + hours * 720);

    this.beginTask(
      options.eyebrow ?? "ATIVIDADE NO COMPUTADOR",
      options.icon ?? "●"
    );
    this.taskCard.classList.add("is-general-activity");

    try {
      await this.moveToComputer();
      await this.animateStage(
        { label: options.title, hours, durationMs },
        options.progressLabel ?? options.detail
      );
      await options.onComplete();

      if (options.completionTitle || options.completionDetail) {
        this.showMessage(
          options.completionTitle ?? options.title,
          options.completionDetail ?? options.detail,
          "milestone"
        );
      }
      return true;
    } finally {
      this.finishTask();
    }
  }

  public showChannelGain(gain: ChannelGain): void {
    const parts = [
      gain.views > 0 ? `+${gain.views.toLocaleString("pt-BR")} views` : null,
      gain.likes > 0 ? `+${gain.likes.toLocaleString("pt-BR")} likes` : null,
      gain.subscribers > 0
        ? `+${gain.subscribers.toLocaleString("pt-BR")} inscritos`
        : null,
      gain.revenue >= 0.01 ? `+R$ ${gain.revenue.toFixed(2)}` : null
    ].filter((item): item is string => item !== null);

    if (parts.length > 0) {
      this.showMessage(gain.sourceTitle, parts.join(" · "), "gain");
    }
  }

  public showMilestone(title: string, detail: string): void {
    this.showMessage(title, detail, "milestone");
  }

  private beginTask(eyebrow: string, icon: string): void {
    this.active = true;
    this.runtime.modalOpen = true;
    this.runtime.keys.clear();
    this.taskCard.classList.add("is-visible");
    this.requireElement("#computer-task-eyebrow").textContent = eyebrow;
    this.requireElement("#computer-task-icon").textContent = icon;
    this.requireElement("#computer-task-label").textContent =
      "Indo até o computador";
    this.requireElement("#computer-task-step").textContent =
      "Preparando a estação";
    this.requireElement("#computer-task-progress").style.width = "4%";
    this.requireElement("#computer-task-time").textContent = this.formatHour(
      this.runtime.state.hour
    );
  }

  private async moveToComputer(): Promise<void> {
    await this.runtime.player.walkTo(2.9, -1.86, 1050);
    this.runtime.player.setPosition(2.9, -2.18);
    this.runtime.player.setComputerWorkPose(true);
  }

  private finishTask(): void {
    this.taskCard.classList.remove("is-visible", "is-general-activity");
    this.runtime.player.setComputerWorkPose(false);
    this.runtime.player.setPosition(2.9, -1.86);
    this.runtime.modalOpen = false;
    this.active = false;
    this.applyDayPhase(this.runtime.state.hour);
  }

  private animateStage(stage: TaskStage, stepText: string): Promise<void> {
    const label = this.requireElement("#computer-task-label");
    const progressBar = this.requireElement("#computer-task-progress");
    const step = this.requireElement("#computer-task-step");
    const time = this.requireElement("#computer-task-time");
    const hudTime = document.getElementById("hud-time");
    const startingHour = this.runtime.state.hour;

    label.textContent = stage.label;
    step.textContent = stepText;
    progressBar.style.width = "0%";

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const update = (now: number): void => {
        const progress = Math.min(1, (now - startedAt) / stage.durationMs);
        const previewHour = startingHour + stage.hours * progress;
        const formattedHour = this.formatHour(previewHour);
        progressBar.style.width = `${Math.round(progress * 100)}%`;
        time.textContent = formattedHour;
        if (hudTime) hudTime.textContent = formattedHour;
        this.runtime.player.updateComputerWorkAnimation(now / 1000);
        this.applyDayPhase(previewHour);

        if (progress < 1) requestAnimationFrame(update);
        else resolve();
      };
      requestAnimationFrame(update);
    });
  }

  private showMessage(
    title: string,
    detail: string,
    type: "gain" | "published" | "milestone"
  ): void {
    const card = document.createElement("article");
    card.className = `computer-gain-card computer-gain-card--${type}`;
    card.innerHTML = `
      <span class="computer-gain-card__icon">${
        type === "published" ? "▶" : type === "milestone" ? "★" : "+"
      }</span>
      <div><small>${this.escapeHtml(title)}</small><strong>${this.escapeHtml(detail)}</strong></div>`;
    this.gainStack.prepend(card);
    window.setTimeout(() => card.classList.add("is-visible"), 20);
    window.setTimeout(() => {
      card.classList.remove("is-visible");
      window.setTimeout(() => card.remove(), 260);
    }, type === "gain" ? 3000 : 4200);
  }

  private updateWorldLayer(): void {
    const projected = this.anchor.clone().project(this.runtime.camera);
    const width = this.runtime.container.clientWidth;
    const height = this.runtime.container.clientHeight;
    this.worldLayer.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    this.worldLayer.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    requestAnimationFrame(() => this.updateWorldLayer());
  }

  private applyDayPhase(hourValue: number): void {
    const normalized = ((hourValue % 24) + 24) % 24;
    const daylight = THREE.MathUtils.clamp(
      Math.sin(((normalized - 6) / 12) * Math.PI),
      0,
      1
    );
    this.runtime.scene.background = new THREE.Color(0x172033).lerp(
      new THREE.Color(0x93a9bd),
      daylight
    );

    this.runtime.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) {
        object.intensity = 0.45 + daylight * 2.65;
        object.color.set(daylight > 0.2 ? 0xfff4dc : 0x91a7ff);
      } else if (object instanceof THREE.HemisphereLight) {
        object.intensity = 0.72 + daylight * 1.63;
      } else if (object instanceof THREE.PointLight) {
        object.intensity = 31 - daylight * 8;
      }
    });
  }

  private applyYouTubePalette(): void {
    this.runtime.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        if ([0x0ea5e9, 0x22d3ee, 0x42e8b4].includes(material.color.getHex())) {
          material.color.setHex(0xff0000);
        }
        if ([0x075985, 0x0891b2].includes(material.emissive.getHex())) {
          material.emissive.setHex(0x8b0000);
        }
      });
    });
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
    const element = this.worldLayer.querySelector<T>(selector);
    if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
    return element;
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

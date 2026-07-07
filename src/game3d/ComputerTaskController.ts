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
          <span class="computer-task-card__icon">▶</span>
          <div><small>PRODUÇÃO EM ANDAMENTO</small><strong id="computer-task-label">Planejando</strong></div>
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
  }

  public async runProduction(
    stages: ProductionStage[],
    advanceStage: (hours: number) => void,
    onPublished: () => void
  ): Promise<void> {
    if (this.active) return;

    this.active = true;
    this.runtime.modalOpen = true;
    this.runtime.keys.clear();
    this.taskCard.classList.add("is-visible");
    this.showTravelState();

    try {
      await this.runtime.player.walkTo(2.9, -1.86, 1050);
      this.runtime.player.setPosition(2.9, -2.18);
      this.runtime.player.setComputerWorkPose(true);

      for (let index = 0; index < stages.length; index += 1) {
        const stage = stages[index];
        await this.animateStage(stage, index, stages.length);
        advanceStage(stage.hours);
      }

      onPublished();
      this.showMessage(
        "Vídeo publicado",
        "O upload terminou e o vídeo já está no canal.",
        "published"
      );
    } finally {
      this.taskCard.classList.remove("is-visible");
      this.runtime.player.setComputerWorkPose(false);
      this.runtime.player.setPosition(2.9, -1.86);
      this.runtime.modalOpen = false;
      this.active = false;
      this.applyDayPhase(this.runtime.state.hour);
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

  private showTravelState(): void {
    this.requireElement("#computer-task-label").textContent =
      "Indo até o computador";
    this.requireElement("#computer-task-step").textContent =
      "Preparando a estação";
    this.requireElement("#computer-task-progress").style.width = "4%";
    this.requireElement("#computer-task-time").textContent = this.formatHour(
      this.runtime.state.hour
    );
  }

  private animateStage(
    stage: ProductionStage,
    stageIndex: number,
    stageCount: number
  ): Promise<void> {
    const label = this.requireElement("#computer-task-label");
    const progressBar = this.requireElement("#computer-task-progress");
    const step = this.requireElement("#computer-task-step");
    const time = this.requireElement("#computer-task-time");
    const hudTime = document.getElementById("hud-time");
    const startingHour = this.runtime.state.hour;

    label.textContent = stage.label;
    step.textContent = `Etapa ${stageIndex + 1} de ${stageCount}`;
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
      <div><small>${this.escapeHtml(title)}</small><strong>${this.escapeHtml(detail)}</strong></div>
    `;
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
    const normalizedHour = ((hourValue % 24) + 24) % 24;
    const daylight = THREE.MathUtils.clamp(
      Math.sin(((normalizedHour - 6) / 12) * Math.PI),
      0,
      1
    );
    const background = new THREE.Color(0x172033).lerp(
      new THREE.Color(0x93a9bd),
      daylight
    );

    this.runtime.scene.background = background;
    if (this.runtime.scene.fog instanceof THREE.Fog) {
      this.runtime.scene.fog.color.copy(background);
    }

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

    this.runtime.container.style.setProperty(
      "--room-daylight",
      daylight.toFixed(3)
    );
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

      const material = Array.isArray(object.material)
        ? object.material[0]
        : object.material;
      const map =
        material instanceof THREE.MeshBasicMaterial ? material.map : null;
      const image = map?.image;

      if (
        map &&
        image instanceof HTMLCanvasElement &&
        object.geometry instanceof THREE.PlaneGeometry &&
        Math.abs(object.geometry.parameters.width - 1.25) < 0.01
      ) {
        const context = image.getContext("2d");
        if (!context) return;
        context.clearRect(0, 0, image.width, image.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, image.width, image.height);
        context.fillStyle = "#ff0000";
        context.fillRect(0, 0, image.width, 72);
        context.fillStyle = "#ffffff";
        context.font = "800 38px Arial";
        context.fillText("CREATOR LIFE", 34, 50);
        context.fillStyle = "#0f0f0f";
        context.font = "700 27px Arial";
        context.fillText("Seu canal", 34, 126);
        context.fillStyle = "#ff0000";
        context.fillRect(34, 154, 156, 22);
        context.fillStyle = "#d8d8d8";
        context.fillRect(34, 204, 420, 12);
        context.fillRect(34, 232, 338, 12);
        map.needsUpdate = true;
      }
    });
  }

  private formatHour(hourValue: number): string {
    const normalizedHour = ((hourValue % 24) + 24) % 24;
    const hour = Math.floor(normalizedHour);
    const minute = Math.floor((normalizedHour - hour) * 60);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  private requireElement<T extends HTMLElement = HTMLElement>(
    selector: string
  ): T {
    const element = this.worldLayer.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Elemento do computador não encontrado: ${selector}`);
    }
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

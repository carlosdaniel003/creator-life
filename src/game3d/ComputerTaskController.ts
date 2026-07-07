import * as THREE from "three";

import type { ChannelGain, PlayerState } from "../game/types";
import type { ProductionStage } from "./VideoProductionModel";
import type { PlayerAvatar } from "./PlayerAvatar";

interface GameRuntime3D {
  container: HTMLElement;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  player: PlayerAvatar;
  state: PlayerState;
  modalOpen: boolean;
  keys: Set<string>;
  renderHud: () => void;
}

export class ComputerTaskController {
  private readonly runtime: GameRuntime3D;
  private readonly worldLayer: HTMLElement;
  private readonly taskCard: HTMLElement;
  private readonly gainStack: HTMLElement;
  private readonly anchor = new THREE.Vector3(2.9, 2.85, -3.45);
  private active = false;
  private frameId = 0;

  public constructor(runtime: GameRuntime3D) {
    this.runtime = runtime;
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
    runtime.container.append(this.worldLayer);

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
    if (this.active) {
      return;
    }

    this.active = true;
    this.runtime.modalOpen = true;
    this.runtime.keys.clear();
    this.runtime.player.setPosition(2.9, -2.18);
    this.runtime.player.setComputerWorkPose(true);
    this.taskCard.classList.add("is-visible");

    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      await this.animateStage(stage, index, stages.length);
      advanceStage(stage.hours);
    }

    onPublished();
    this.taskCard.classList.remove("is-visible");
    this.runtime.player.setComputerWorkPose(false);
    this.runtime.player.setPosition(2.9, -1.86);
    this.runtime.modalOpen = false;
    this.active = false;
    this.applyDayPhase(this.runtime.state.hour);
    this.showMessage("Vídeo publicado", "O upload terminou e o vídeo já está no canal.", "published");
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

    if (parts.length === 0) {
      return;
    }

    this.showMessage(gain.sourceTitle, parts.join(" · "), "gain");
  }

  public showMilestone(title: string, detail: string): void {
    this.showMessage(title, detail, "milestone");
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
    const startingHour = this.runtime.state.hour;

    label.textContent = stage.label;
    step.textContent = `Etapa ${stageIndex + 1} de ${stageCount}`;
    progressBar.style.width = "0%";

    return new Promise((resolve) => {
      const startedAt = performance.now();

      const update = (now: number): void => {
        const progress = Math.min(1, (now - startedAt) / stage.durationMs);
        const previewHour = startingHour + stage.hours * progress;
        progressBar.style.width = `${Math.round(progress * 100)}%`;
        time.textContent = this.formatHour(previewHour);
        this.runtime.player.updateComputerWorkAnimation(now / 1000);
        this.applyDayPhase(previewHour);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          resolve();
        }
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
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;

    this.worldLayer.style.left = `${x}px`;
    this.worldLayer.style.top = `${y}px`;
    this.frameId = requestAnimationFrame(() => this.updateWorldLayer());
  }

  private applyDayPhase(hourValue: number): void {
    const normalizedHour = ((hourValue % 24) + 24) % 24;
    const daylight = THREE.MathUtils.clamp(
      Math.sin(((normalizedHour - 6) / 12) * Math.PI),
      0,
      1
    );
    const nightColor = new THREE.Color(0x172033);
    const dayColor = new THREE.Color(0x93a9bd);
    const background = nightColor.clone().lerp(dayColor, daylight);

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

    this.runtime.container.style.setProperty("--room-daylight", daylight.toFixed(3));
  }

  private applyYouTubePalette(): void {
    this.runtime.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          return;
        }

        const color = material.color.getHex();
        if ([0x0ea5e9, 0x22d3ee, 0x42e8b4].includes(color)) {
          material.color.setHex(0xff0000);
        }

        const emissive = material.emissive.getHex();
        if ([0x075985, 0x0891b2].includes(emissive)) {
          material.emissive.setHex(0x8b0000);
        }
      });

      const material = Array.isArray(object.material)
        ? object.material[0]
        : object.material;
      const map = material instanceof THREE.MeshBasicMaterial ? material.map : null;
      const image = map?.image;

      if (
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

import * as THREE from "three";

import type { BookId, PlayerState } from "../game/types";
import type { PlayerAvatar } from "./PlayerAvatar";

interface ReadingRuntime3D {
  container: HTMLElement;
  camera: THREE.OrthographicCamera;
  player: PlayerAvatar;
  state: PlayerState;
  modalOpen: boolean;
  keys: Set<string>;
}

interface ReadingTaskOptions {
  bookId: BookId;
  title: string;
  hours: 2 | 4;
  advanceTime: (hours: number) => void;
  previewWorld: (hour: number) => void;
  onComplete: () => void;
}

export class ReadingTaskController {
  private readonly layer: HTMLElement;
  private readonly card: HTMLElement;
  private readonly anchor = new THREE.Vector3(0.1, 2.72, -4.05);
  private active = false;

  public constructor(private readonly runtime: ReadingRuntime3D) {
    this.layer = document.createElement("div");
    this.layer.className = "reading-world-layer";
    this.layer.innerHTML = `
      <section class="reading-task-card" aria-live="polite">
        <div class="reading-task-card__header">
          <span class="reading-task-card__icon">▤</span>
          <div><small>LEITURA EM ANDAMENTO</small><strong id="reading-task-title">Livro</strong></div>
        </div>
        <div class="reading-task-card__progress"><div id="reading-task-progress"></div></div>
        <div class="reading-task-card__meta">
          <span id="reading-task-detail">Sessão de 2 horas</span>
          <strong id="reading-task-time">08:00</strong>
        </div>
      </section>
    `;
    this.runtime.container.append(this.layer);
    this.card = this.requireElement(".reading-task-card");
    this.updateWorldLayer();
  }

  public isActive(): boolean {
    return this.active;
  }

  public async run(options: ReadingTaskOptions): Promise<void> {
    if (this.active) return;

    this.active = true;
    this.runtime.modalOpen = true;
    this.runtime.keys.clear();
    this.card.classList.add("is-visible");

    const title = this.requireElement("#reading-task-title");
    const detail = this.requireElement("#reading-task-detail");
    const progressBar = this.requireElement("#reading-task-progress");
    const time = this.requireElement("#reading-task-time");
    title.textContent = "Indo até a estante";
    detail.textContent = "Escolhendo o local de leitura";
    progressBar.style.width = "4%";
    time.textContent = this.formatHour(this.runtime.state.hour);

    try {
      await this.runtime.player.walkTo(0.1, -2.95, 1000);
      this.runtime.player.setPosition(0.1, -3.18);
      this.runtime.player.setReadingPose(true);

      const hudTime = document.getElementById("hud-time");
      const startingHour = this.runtime.state.hour;
      const durationMs = options.hours === 4 ? 5200 : 3300;

      title.textContent = options.title;
      detail.textContent = `Sessão de ${options.hours} horas`;
      progressBar.style.width = "0%";

      await new Promise<void>((resolve) => {
        const startedAt = performance.now();
        const update = (now: number): void => {
          const progress = Math.min(1, (now - startedAt) / durationMs);
          const previewHour = startingHour + options.hours * progress;
          const formatted = this.formatHour(previewHour);

          progressBar.style.width = `${Math.round(progress * 100)}%`;
          time.textContent = formatted;
          if (hudTime) hudTime.textContent = formatted;
          this.runtime.player.updateReadingAnimation(now / 1000);
          options.previewWorld(previewHour);

          if (progress < 1) requestAnimationFrame(update);
          else resolve();
        };
        requestAnimationFrame(update);
      });

      options.advanceTime(options.hours);
      options.onComplete();
    } finally {
      this.card.classList.remove("is-visible");
      this.runtime.player.setReadingPose(false);
      this.runtime.player.setPosition(0.1, -2.95);
      this.runtime.modalOpen = false;
      this.active = false;
    }
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
    if (!element) throw new Error(`Elemento de leitura não encontrado: ${selector}`);
    return element;
  }
}

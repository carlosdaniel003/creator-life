import * as THREE from "three";

import type { PlayerState, WeatherType } from "../game/types";
import "../pause-menu.css";
import { PauseMenuController } from "./PauseMenuController";

interface WorldTimeHost {
  getState: () => PlayerState & { age: number };
  advanceTime: (hours: number) => void;
  isVisualPreviewActive: () => boolean;
  onBirthday: (age: number) => void;
  onChange: () => void;
}

const REAL_MINUTES_PER_GAME_DAY = 24;
const REAL_MS_PER_GAME_HOUR =
  (REAL_MINUTES_PER_GAME_DAY * 60_000) / 24;
const DAYS_PER_YEAR = 360;
const SAVE_KEYS = [
  "creator-life-save-v5",
  "creator-life-save-v4",
  "creator-life-save-v3",
  "creator-life-save-v2",
  "creator-life-save-v1"
];

const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: "Céu limpo",
  cloudy: "Nublado",
  rain: "Chuva",
  storm: "Tempestade"
};

export class WorldTimeSystem {
  private readonly status: HTMLElement;
  private readonly directionalLight: THREE.DirectionalLight | null;
  private readonly hemisphereLight: THREE.HemisphereLight | null;
  private readonly roomLight: THREE.PointLight | null;
  private readonly windowMaterial: THREE.MeshBasicMaterial | null;
  private readonly rain: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  private readonly pauseMenu: PauseMenuController;
  private timer: number | null = null;
  private animationFrame = 0;
  private lastTickAt = performance.now();
  private lastWeatherDay = -1;
  private weather: WeatherType = "clear";
  private lightning = 0;
  private paused = false;

  public constructor(
    private readonly container: HTMLElement,
    private readonly scene: THREE.Scene,
    private readonly host: WorldTimeHost
  ) {
    this.directionalLight = this.findDirectionalLight();
    this.hemisphereLight = this.findHemisphereLight();
    this.roomLight = this.findRoomLight();
    this.windowMaterial = this.findWindowMaterial();
    const rainVisual = this.createRainVisual();
    this.rain = rainVisual.lines;
    this.rainPositions = rainVisual.positions;
    this.scene.add(this.rain);

    this.status = document.createElement("section");
    this.status.className = "world-status-hud";
    this.status.setAttribute("aria-label", "Tempo, clima e idade");
    this.container.append(this.status);

    this.pauseMenu = new PauseMenuController(this.container, {
      canOpen: () => !this.isTimedTaskRunning(),
      onBlocked: () => this.showPauseBlocked(),
      getSummary: () => {
        const state = this.host.getState();
        return {
          day: state.day,
          time: this.formatTime(state.hour),
          age: state.age,
          videos: state.videos,
          subscribers: state.subscribers
        };
      },
      onPauseChange: (paused) => {
        this.paused = paused;
        this.lastTickAt = performance.now();
        this.status.classList.toggle("is-paused", paused);
        this.updateStatus();
      },
      onSave: () => this.host.onChange(),
      onNewStory: () => this.startNewStory()
    });

    const state = this.host.getState();
    state.age = Number.isFinite(state.age)
      ? state.age
      : 18 + Math.floor((state.day - 1) / DAYS_PER_YEAR);
    this.refreshWeather(true);
    this.updateEnvironment();
    this.updateStatus();
  }

  public start(): void {
    if (this.timer !== null) return;
    this.lastTickAt = performance.now();
    this.timer = window.setInterval(() => this.tick(), 1000);
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  public stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.animationFrame);
  }

  public getWeather(): WeatherType {
    return this.weather;
  }

  public getDayPhase(): string {
    const hour = this.normalizeHour(this.host.getState().hour);
    if (hour < 5) return "Madrugada";
    if (hour < 7) return "Amanhecer";
    if (hour < 12) return "Manhã";
    if (hour < 17) return "Tarde";
    if (hour < 19) return "Entardecer";
    return "Noite";
  }

  public preview(hour: number): void {
    this.applyEnvironment(hour, this.weather);
    this.updateStatus(hour);
  }

  public refresh(): void {
    this.refreshWeather(false);
    this.updateEnvironment();
    this.updateStatus();
  }

  private tick(): void {
    const now = performance.now();
    const elapsedMs = Math.min(5000, Math.max(0, now - this.lastTickAt));
    this.lastTickAt = now;

    if (document.hidden || this.paused) return;

    const state = this.host.getState();
    const previousAge = state.age;
    const gameHours = elapsedMs / REAL_MS_PER_GAME_HOUR;
    this.host.advanceTime(gameHours);

    const expectedAge = 18 + Math.floor((state.day - 1) / DAYS_PER_YEAR);
    if (expectedAge > previousAge) {
      state.age = expectedAge;
      this.host.onBirthday(expectedAge);
      this.host.onChange();
    }

    this.refreshWeather(false);
    this.updateStatus();
  }

  private animate(): void {
    const timedTaskRunning = this.isTimedTaskRunning();
    this.pauseMenu.setDisabled(timedTaskRunning);

    if (!this.paused) {
      if (!this.host.isVisualPreviewActive()) {
        this.updateEnvironment();
      }
      this.updateRain(1 / 60);
    }
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private refreshWeather(force: boolean): void {
    const day = this.host.getState().day;
    if (!force && day === this.lastWeatherDay) return;

    this.lastWeatherDay = day;
    this.weather = this.weatherForDay(day);
    this.rain.visible = this.weather === "rain" || this.weather === "storm";
    this.updateStatus();
  }

  private weatherForDay(day: number): WeatherType {
    const value = this.seededRandom(day * 9301 + 49297);
    if (value < 0.55) return "clear";
    if (value < 0.79) return "cloudy";
    if (value < 0.96) return "rain";
    return "storm";
  }

  private updateEnvironment(): void {
    this.applyEnvironment(this.host.getState().hour, this.weather);
  }

  private applyEnvironment(hourValue: number, weather: WeatherType): void {
    const hour = this.normalizeHour(hourValue);
    const daylight = THREE.MathUtils.clamp(
      Math.sin(((hour - 6) / 12) * Math.PI),
      0,
      1
    );
    const dawn = Math.exp(-Math.pow((hour - 6.3) / 1.4, 2));
    const dusk = Math.exp(-Math.pow((hour - 18.2) / 1.5, 2));
    const weatherLight =
      weather === "storm" ? 0.48 : weather === "rain" ? 0.66 : weather === "cloudy" ? 0.82 : 1;

    const night = new THREE.Color(0x07111f);
    const day = new THREE.Color(0x93a9bd);
    const overcast = new THREE.Color(0x596575);
    const warm = new THREE.Color(0xd8896b);
    const background = night.clone().lerp(day, daylight * weatherLight);
    background.lerp(warm, Math.min(0.3, (dawn + dusk) * 0.22));
    if (weather !== "clear") {
      background.lerp(overcast, weather === "storm" ? 0.56 : weather === "rain" ? 0.38 : 0.22);
    }

    this.lightning *= 0.84;
    if (weather === "storm" && daylight < 0.8 && Math.random() < 0.0025) {
      this.lightning = 1;
    }
    if (this.lightning > 0.02) {
      background.lerp(new THREE.Color(0xdbeafe), this.lightning * 0.52);
    }

    this.scene.background = background;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(background);
      this.scene.fog.near = weather === "storm" ? 10 : weather === "rain" ? 13 : 17;
      this.scene.fog.far = weather === "storm" ? 22 : weather === "rain" ? 25 : 30;
    }

    if (this.directionalLight) {
      this.directionalLight.intensity =
        0.18 + daylight * 2.95 * weatherLight + this.lightning * 3.4;
      this.directionalLight.color
        .set(daylight > 0.15 ? 0xfff1dc : 0x879dcc)
        .lerp(new THREE.Color(0xffffff), this.lightning);
      const angle = ((hour - 6) / 24) * Math.PI * 2;
      this.directionalLight.position.set(
        Math.cos(angle) * 8,
        3.5 + daylight * 8,
        Math.sin(angle) * 8
      );
    }

    if (this.hemisphereLight) {
      this.hemisphereLight.intensity =
        0.42 + daylight * 1.9 * weatherLight + this.lightning * 1.8;
      this.hemisphereLight.color.copy(background).lerp(new THREE.Color(0xe7f2ff), 0.48);
    }

    if (this.roomLight) {
      this.roomLight.intensity = 8 + (1 - daylight) * 23;
      this.roomLight.color.set(hour >= 18 || hour < 6 ? 0xffd7a3 : 0xffead0);
    }

    if (this.windowMaterial) {
      const windowTint = new THREE.Color(0xffffff)
        .lerp(new THREE.Color(0x26354d), 1 - daylight)
        .lerp(new THREE.Color(0x77808b), weather === "clear" ? 0 : weather === "cloudy" ? 0.22 : 0.4);
      this.windowMaterial.color.copy(windowTint);
    }

    this.container.style.setProperty("--room-daylight", daylight.toFixed(3));
    this.container.style.setProperty("--weather-darkness", (1 - weatherLight).toFixed(3));
  }

  private updateRain(delta: number): void {
    if (!this.rain.visible) return;

    const speed = this.weather === "storm" ? 4.8 : 3.1;
    for (let index = 0; index < this.rainPositions.length; index += 6) {
      let top = this.rainPositions[index + 1] - delta * speed;
      if (top < -0.82) top = 0.9 + Math.random() * 0.25;
      this.rainPositions[index + 1] = top;
      this.rainPositions[index + 4] = top - (this.weather === "storm" ? 0.28 : 0.18);
    }
    const position = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    position.needsUpdate = true;
  }

  private updateStatus(previewHour?: number): void {
    const state = this.host.getState();
    const hour = previewHour ?? state.hour;
    this.status.innerHTML = `
      <div><span>${this.getDayPhaseForHour(hour)}</span><strong>${WEATHER_LABELS[this.weather]}</strong></div>
      <div><span>Idade</span><strong>${state.age} anos</strong></div>
      <div><span>${this.paused ? "Estado" : "Ciclo do mundo"}</span><strong>${this.paused ? "Jogo pausado" : "24 min por dia"}</strong></div>
    `;
    this.status.dataset.weather = this.weather;
  }

  private getDayPhaseForHour(hourValue: number): string {
    const hour = this.normalizeHour(hourValue);
    if (hour < 5) return "Madrugada";
    if (hour < 7) return "Amanhecer";
    if (hour < 12) return "Manhã";
    if (hour < 17) return "Tarde";
    if (hour < 19) return "Entardecer";
    return "Noite";
  }

  private createRainVisual(): {
    lines: THREE.LineSegments;
    positions: Float32Array;
  } {
    const count = 72;
    const positions = new Float32Array(count * 6);

    for (let index = 0; index < count; index += 1) {
      const offset = index * 6;
      const x = -1.28 + Math.random() * 2.56;
      const y = -0.78 + Math.random() * 1.68;
      const length = 0.14 + Math.random() * 0.16;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = 0;
      positions[offset + 3] = x + 0.04;
      positions[offset + 4] = y - length;
      positions[offset + 5] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xbfe5ff,
      transparent: true,
      opacity: 0.72,
      depthTest: false
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.position.set(-3.1, 2.35, -4.25);
    lines.renderOrder = 5;
    lines.visible = false;
    return { lines, positions };
  }

  private findDirectionalLight(): THREE.DirectionalLight | null {
    let result: THREE.DirectionalLight | null = null;
    this.scene.traverse((object) => {
      if (!result && object instanceof THREE.DirectionalLight) result = object;
    });
    return result;
  }

  private findHemisphereLight(): THREE.HemisphereLight | null {
    let result: THREE.HemisphereLight | null = null;
    this.scene.traverse((object) => {
      if (!result && object instanceof THREE.HemisphereLight) result = object;
    });
    return result;
  }

  private findRoomLight(): THREE.PointLight | null {
    let result: THREE.PointLight | null = null;
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.PointLight)) return;
      if (object.position.distanceTo(new THREE.Vector3(0.4, 3.1, 0.3)) < 0.2) {
        result = object;
      }
    });
    return result;
  }

  private findWindowMaterial(): THREE.MeshBasicMaterial | null {
    let result: THREE.MeshBasicMaterial | null = null;
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!(object.geometry instanceof THREE.PlaneGeometry)) return;
      const { width, height } = object.geometry.parameters;
      const material = Array.isArray(object.material)
        ? object.material[0]
        : object.material;
      if (
        Math.abs(width - 2.65) < 0.01 &&
        Math.abs(height - 1.6) < 0.01 &&
        material instanceof THREE.MeshBasicMaterial
      ) {
        result = material;
      }
    });
    return result;
  }

  private isTimedTaskRunning(): boolean {
    return Boolean(
      this.container.querySelector(
        ".computer-task-card.is-visible, .reading-task-card.is-visible"
      )
    );
  }

  private showPauseBlocked(): void {
    const toast = this.container.querySelector<HTMLElement>(".game-toast");
    if (!toast) return;
    toast.textContent = "Conclua a atividade atual antes de pausar.";
    toast.dataset.type = "warning";
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  private startNewStory(): void {
    SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  }

  private formatTime(value: number): string {
    const normalized = this.normalizeHour(value);
    const hour = Math.floor(normalized);
    const minute = Math.floor((normalized - hour) * 60);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  private normalizeHour(value: number): number {
    return ((value % 24) + 24) % 24;
  }

  private seededRandom(seed: number): number {
    const value = Math.sin(seed) * 43758.5453;
    return value - Math.floor(value);
  }
}

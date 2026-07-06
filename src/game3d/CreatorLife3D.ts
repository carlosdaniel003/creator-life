import * as THREE from "three";

import { PlayerAvatar } from "./PlayerAvatar";
import { RoomWorld } from "./RoomWorld";
import type { InteractableDefinition, PlayerState } from "./types";

const PLAYER_RADIUS = 0.34;
const MOVE_SPEED = 3.15;
const CAMERA_OFFSET = new THREE.Vector3(9.5, 10.5, 9.5);
const ROOM_LIMITS = {
  minX: -5.48,
  maxX: 5.48,
  minZ: -3.98,
  maxZ: 3.98
};

export class CreatorLife3D {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.OrthographicCamera;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly keys = new Set<string>();
  private readonly player = new PlayerAvatar();
  private readonly room: RoomWorld;

  private nearestInteractable: InteractableDefinition | null = null;
  private hoveredInteractableId: string | null = null;
  private modalOpen = false;
  private lastToastTimer: number | null = null;

  private state: PlayerState = {
    day: 1,
    hour: 8,
    energy: 100,
    hunger: 100,
    creativity: 70,
    money: 80,
    subscribers: 0,
    totalViews: 0,
    videos: 0
  };

  private hudDay!: HTMLElement;
  private hudTime!: HTMLElement;
  private hudMoney!: HTMLElement;
  private hudSubscribers!: HTMLElement;
  private hudViews!: HTMLElement;
  private energyValue!: HTMLElement;
  private hungerValue!: HTMLElement;
  private creativityValue!: HTMLElement;
  private energyBar!: HTMLElement;
  private hungerBar!: HTMLElement;
  private creativityBar!: HTMLElement;
  private interactionPrompt!: HTMLElement;
  private interactionName!: HTMLElement;
  private interactionDescription!: HTMLElement;
  private modalBackdrop!: HTMLElement;
  private modalTitle!: HTMLElement;
  private modalBody!: HTMLElement;
  private modalActions!: HTMLElement;
  private toast!: HTMLElement;

  public constructor(container: HTMLElement) {
    this.container = container;
    this.injectInterface();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.id = "game-canvas";
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Quarto 3D isométrico do Creator Life"
    );
    this.container.prepend(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
    this.scene.background = new THREE.Color(0x93a9bd);
    this.scene.fog = new THREE.Fog(0x93a9bd, 17, 30);

    this.configureLights();
    this.room = new RoomWorld(this.scene);
    this.scene.add(this.player.group);

    this.configureEvents();
    this.resize();
    this.updateCamera(true);
    this.renderHud();

    this.renderer.setAnimationLoop(() => {
      this.update();
    });
  }

  private configureLights(): void {
    const hemisphere = new THREE.HemisphereLight(0xdbeafe, 0x4b3b31, 2.35);
    this.scene.add(hemisphere);

    const sunlight = new THREE.DirectionalLight(0xfff4dc, 3.1);
    sunlight.position.set(3.5, 9, 4.5);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = -9;
    sunlight.shadow.camera.right = 9;
    sunlight.shadow.camera.top = 9;
    sunlight.shadow.camera.bottom = -9;
    sunlight.shadow.camera.near = 0.1;
    sunlight.shadow.camera.far = 30;
    sunlight.shadow.bias = -0.00025;
    this.scene.add(sunlight);

    const roomLight = new THREE.PointLight(0xffe7b5, 25, 11, 2);
    roomLight.position.set(0.4, 3.1, 0.3);
    roomLight.castShadow = true;
    roomLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(roomLight);
  }

  private configureEvents(): void {
    window.addEventListener("resize", () => {
      this.resize();
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (["w", "a", "s", "d", "f", "escape"].includes(key)) {
        event.preventDefault();
      }

      if (key === "escape" && this.modalOpen) {
        this.closeModal();
        return;
      }

      if (key === "f" && !event.repeat && !this.modalOpen) {
        this.interactWithNearest();
        return;
      }

      this.keys.add(key);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });

    this.renderer.domElement.addEventListener("pointermove", (event) => {
      this.updatePointer(event);
      const id = this.pickInteractable();
      this.hoveredInteractableId = id;
      this.renderer.domElement.style.cursor = id ? "pointer" : "default";
    });

    this.renderer.domElement.addEventListener("pointerleave", () => {
      this.hoveredInteractableId = null;
      this.renderer.domElement.style.cursor = "default";
    });

    this.renderer.domElement.addEventListener("click", (event) => {
      if (this.modalOpen) {
        return;
      }

      this.updatePointer(event);
      const id = this.pickInteractable();

      if (id) {
        this.interact(id, "mouse");
      }
    });

    this.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === this.modalBackdrop) {
        this.closeModal();
      }
    });
  }

  private update(): void {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    const movement = this.getMovementVector();
    const moving = movement.lengthSq() > 0 && !this.modalOpen;

    if (moving) {
      movement.normalize();
      this.movePlayer(movement, MOVE_SPEED * delta);
      this.player.setFacing(movement);
    }

    this.player.updateWalkAnimation(elapsed, moving);
    this.room.update(elapsed);
    this.updateNearestInteractable();
    this.updateCamera(false);
    this.renderer.render(this.scene, this.camera);
  }

  private getMovementVector(): THREE.Vector3 {
    const direction = new THREE.Vector3();

    if (this.modalOpen) {
      return direction;
    }

    if (this.keys.has("w")) {
      direction.add(new THREE.Vector3(-1, 0, -1));
    }
    if (this.keys.has("s")) {
      direction.add(new THREE.Vector3(1, 0, 1));
    }
    if (this.keys.has("a")) {
      direction.add(new THREE.Vector3(-1, 0, 1));
    }
    if (this.keys.has("d")) {
      direction.add(new THREE.Vector3(1, 0, -1));
    }

    return direction;
  }

  private movePlayer(direction: THREE.Vector3, distance: number): void {
    const position = this.player.group.position;
    const previousX = position.x;
    const previousZ = position.z;

    position.x = THREE.MathUtils.clamp(
      position.x + direction.x * distance,
      ROOM_LIMITS.minX,
      ROOM_LIMITS.maxX
    );

    if (this.collides(position.x, position.z)) {
      position.x = previousX;
    }

    position.z = THREE.MathUtils.clamp(
      position.z + direction.z * distance,
      ROOM_LIMITS.minZ,
      ROOM_LIMITS.maxZ
    );

    if (this.collides(position.x, position.z)) {
      position.z = previousZ;
    }
  }

  private collides(x: number, z: number): boolean {
    return this.room.colliders.some((box) => {
      const nearestX = THREE.MathUtils.clamp(x, box.minX, box.maxX);
      const nearestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ);
      const distanceX = x - nearestX;
      const distanceZ = z - nearestZ;

      return (
        distanceX * distanceX + distanceZ * distanceZ <
        PLAYER_RADIUS * PLAYER_RADIUS
      );
    });
  }

  private updateCamera(immediate: boolean): void {
    const target = this.player.group.position.clone();
    target.y = 0.75;
    const desiredPosition = target.clone().add(CAMERA_OFFSET);

    if (immediate) {
      this.camera.position.copy(desiredPosition);
    } else {
      this.camera.position.lerp(desiredPosition, 0.08);
    }

    this.camera.lookAt(target);
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 320);
    const aspect = width / height;
    const frustumHeight = 10.5;

    this.camera.left = (-frustumHeight * aspect) / 2;
    this.camera.right = (frustumHeight * aspect) / 2;
    this.camera.top = frustumHeight / 2;
    this.camera.bottom = -frustumHeight / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickInteractable(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(
      this.room.clickTargets,
      true
    );

    for (const intersection of intersections) {
      const id = this.room.getInteractableIdFromObject(intersection.object);

      if (id) {
        return id;
      }
    }

    return null;
  }

  private updateNearestInteractable(): void {
    const playerPosition = this.player.group.position;
    let nearest: InteractableDefinition | null = null;
    let shortestDistance = Number.POSITIVE_INFINITY;

    for (const interactable of this.room.interactables.values()) {
      const distance = this.horizontalDistance(
        playerPosition,
        interactable.position
      );

      if (distance <= interactable.maxDistance && distance < shortestDistance) {
        shortestDistance = distance;
        nearest = interactable;
      }
    }

    this.nearestInteractable = nearest;
    const highlightId = this.hoveredInteractableId ?? nearest?.id ?? null;
    this.room.setHighlighted(highlightId);
    this.renderInteractionPrompt(nearest);
  }

  private renderInteractionPrompt(
    interactable: InteractableDefinition | null
  ): void {
    if (!interactable || this.modalOpen) {
      this.interactionPrompt.classList.remove("is-visible");
      return;
    }

    this.interactionName.textContent = interactable.label;
    this.interactionDescription.textContent = interactable.prompt;
    this.interactionPrompt.classList.add("is-visible");
  }

  private interactWithNearest(): void {
    if (!this.nearestInteractable) {
      this.showToast("Aproxime-se de um objeto para interagir.", "neutral");
      return;
    }

    this.interact(this.nearestInteractable.id, "keyboard");
  }

  private interact(id: string, source: "keyboard" | "mouse"): void {
    const interactable = this.room.interactables.get(id);

    if (!interactable) {
      return;
    }

    if (source === "keyboard") {
      const distance = this.horizontalDistance(
        this.player.group.position,
        interactable.position
      );

      if (distance > interactable.maxDistance) {
        this.showToast("Você está longe demais desse objeto.", "warning");
        return;
      }
    }

    switch (id) {
      case "computer":
        this.openComputer();
        break;
      case "bed":
        this.openBed();
        break;
      case "fridge":
        this.openFridge();
        break;
      case "wardrobe":
        this.player.cycleOutfit();
        this.showToast("Você trocou a cor da roupa.", "success");
        break;
      case "shelf":
        this.state.creativity = THREE.MathUtils.clamp(
          this.state.creativity + 8,
          0,
          100
        );
        this.advanceTime(1);
        this.renderHud();
        this.showToast(
          "Você encontrou novas ideias. +8 criatividade.",
          "success"
        );
        break;
      case "door":
        this.showModal(
          "Saída do quarto",
          `<p>O restante da cidade ainda está em construção.</p>
           <p class="modal-note">Por enquanto, seu objetivo é desenvolver o canal usando os recursos disponíveis no quarto.</p>`,
          [{ label: "Fechar", action: () => this.closeModal(), secondary: true }]
        );
        break;
      default:
        break;
    }
  }

  private openComputer(): void {
    this.showModal(
      "Estação de produção",
      `<div class="modal-stat-grid">
        <div><span>Vídeos publicados</span><strong>${this.state.videos}</strong></div>
        <div><span>Total de views</span><strong>${this.state.totalViews.toLocaleString("pt-BR")}</strong></div>
      </div>
      <p>O computador é usado para planejar, gravar, editar e publicar conteúdo.</p>
      <p class="modal-note">Nesta primeira migração 3D, a ação rápida abaixo valida a interação do cenário. O editor completo de tema, título, thumbnail e blocos continuará sendo conectado ao computador.</p>`,
      [
        {
          label: "Produzir vídeo rápido",
          action: () => this.produceQuickVideo()
        },
        {
          label: "Cancelar",
          action: () => this.closeModal(),
          secondary: true
        }
      ]
    );
  }

  private produceQuickVideo(): void {
    if (this.state.energy < 25 || this.state.creativity < 15) {
      this.showToast(
        "Você precisa de 25 de energia e 15 de criatividade.",
        "warning"
      );
      return;
    }

    const quality = Math.round(
      THREE.MathUtils.clamp(
        45 + this.state.creativity * 0.38 + Math.random() * 25,
        0,
        100
      )
    );
    const views = Math.max(
      12,
      Math.floor(
        45 +
          quality * 3.2 +
          this.state.subscribers * 0.18 +
          Math.random() * 180
      )
    );
    const subscribers = Math.max(1, Math.floor(views * (0.025 + quality / 2200)));

    this.state.energy -= 25;
    this.state.creativity -= 15;
    this.state.videos += 1;
    this.state.totalViews += views;
    this.state.subscribers += subscribers;
    this.advanceTime(4);
    this.renderHud();
    this.closeModal();
    this.showToast(
      `Vídeo publicado: ${views.toLocaleString("pt-BR")} views e +${subscribers} inscritos.`,
      "success"
    );
  }

  private openBed(): void {
    this.showModal(
      "Descansar",
      `<p>Dormir recupera energia e criatividade, mas faz o tempo avançar.</p>
       <div class="modal-preview"><span>Duração</span><strong>7 horas</strong></div>`,
      [
        {
          label: "Dormir",
          action: () => {
            this.state.energy = THREE.MathUtils.clamp(
              this.state.energy + 62,
              0,
              100
            );
            this.state.creativity = THREE.MathUtils.clamp(
              this.state.creativity + 18,
              0,
              100
            );
            this.advanceTime(7);
            this.renderHud();
            this.closeModal();
            this.showToast("Você descansou e recuperou energia.", "success");
          }
        },
        {
          label: "Cancelar",
          action: () => this.closeModal(),
          secondary: true
        }
      ]
    );
  }

  private openFridge(): void {
    this.showModal(
      "Preparar refeição",
      `<p>Uma refeição simples recupera sua fome e consome uma hora.</p>
       <div class="modal-preview"><span>Custo</span><strong>R$ 10,00</strong></div>`,
      [
        {
          label: "Comer",
          action: () => {
            if (this.state.money < 10) {
              this.showToast("Dinheiro insuficiente.", "warning");
              return;
            }

            this.state.money -= 10;
            this.state.hunger = THREE.MathUtils.clamp(
              this.state.hunger + 48,
              0,
              100
            );
            this.advanceTime(1);
            this.renderHud();
            this.closeModal();
            this.showToast("Refeição concluída. +48 fome.", "success");
          }
        },
        {
          label: "Cancelar",
          action: () => this.closeModal(),
          secondary: true
        }
      ]
    );
  }

  private advanceTime(hours: number): void {
    this.state.hour += hours;
    this.state.hunger = THREE.MathUtils.clamp(
      this.state.hunger - hours * 4,
      0,
      100
    );

    while (this.state.hour >= 24) {
      this.state.hour -= 24;
      this.state.day += 1;
    }

    if (this.state.hunger === 0) {
      this.state.energy = THREE.MathUtils.clamp(
        this.state.energy - 12,
        0,
        100
      );
    }
  }

  private renderHud(): void {
    this.hudDay.textContent = `Dia ${this.state.day}`;
    this.hudTime.textContent = `${String(this.state.hour).padStart(2, "0")}:00`;
    this.hudMoney.textContent = `R$ ${this.state.money.toFixed(2)}`;
    this.hudSubscribers.textContent = this.state.subscribers.toLocaleString("pt-BR");
    this.hudViews.textContent = this.state.totalViews.toLocaleString("pt-BR");

    this.energyValue.textContent = `${this.state.energy}/100`;
    this.hungerValue.textContent = `${this.state.hunger}/100`;
    this.creativityValue.textContent = `${this.state.creativity}/100`;

    this.energyBar.style.width = `${this.state.energy}%`;
    this.hungerBar.style.width = `${this.state.hunger}%`;
    this.creativityBar.style.width = `${this.state.creativity}%`;
  }

  private showModal(
    title: string,
    body: string,
    actions: Array<{
      label: string;
      action: () => void;
      secondary?: boolean;
    }>
  ): void {
    this.modalOpen = true;
    this.keys.clear();
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = body;
    this.modalActions.replaceChildren();

    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.secondary
        ? "modal-button modal-button--secondary"
        : "modal-button";
      button.textContent = action.label;
      button.addEventListener("click", action.action);
      this.modalActions.append(button);
    });

    this.modalBackdrop.classList.add("is-visible");
    this.interactionPrompt.classList.remove("is-visible");
  }

  private closeModal(): void {
    this.modalOpen = false;
    this.modalBackdrop.classList.remove("is-visible");
  }

  private showToast(
    message: string,
    type: "success" | "warning" | "neutral"
  ): void {
    if (this.lastToastTimer !== null) {
      window.clearTimeout(this.lastToastTimer);
    }

    this.toast.textContent = message;
    this.toast.dataset.type = type;
    this.toast.classList.add("is-visible");

    this.lastToastTimer = window.setTimeout(() => {
      this.toast.classList.remove("is-visible");
      this.lastToastTimer = null;
    }, 3200);
  }

  private horizontalDistance(a: THREE.Vector3, b: THREE.Vector3): number {
    const deltaX = a.x - b.x;
    const deltaZ = a.z - b.z;
    return Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
  }

  private injectInterface(): void {
    this.container.innerHTML = `
      <section class="hud hud--top-left" aria-label="Identificação do jogo">
        <div class="brand-card">
          <span class="brand-card__eyebrow">CREATOR LIFE</span>
          <strong>Quarto inicial</strong>
          <small>Construa seu canal do zero</small>
        </div>
      </section>

      <section class="hud hud--top-right" aria-label="Status do jogador">
        <div class="time-card">
          <div><span id="hud-day">Dia 1</span><strong id="hud-time">08:00</strong></div>
          <div class="time-card__money"><span>Saldo</span><strong id="hud-money">R$ 80,00</strong></div>
        </div>
        <div class="resource-card">
          <div class="resource-row">
            <div class="resource-row__label"><span>Energia</span><strong id="energy-value">100/100</strong></div>
            <div class="resource-track"><div id="energy-bar" class="resource-fill resource-fill--energy"></div></div>
          </div>
          <div class="resource-row">
            <div class="resource-row__label"><span>Fome</span><strong id="hunger-value">100/100</strong></div>
            <div class="resource-track"><div id="hunger-bar" class="resource-fill resource-fill--hunger"></div></div>
          </div>
          <div class="resource-row">
            <div class="resource-row__label"><span>Criatividade</span><strong id="creativity-value">70/100</strong></div>
            <div class="resource-track"><div id="creativity-bar" class="resource-fill resource-fill--creativity"></div></div>
          </div>
        </div>
        <div class="channel-card">
          <div><span>Inscritos</span><strong id="hud-subscribers">0</strong></div>
          <div><span>Visualizações</span><strong id="hud-views">0</strong></div>
        </div>
      </section>

      <section class="controls-card" aria-label="Controles">
        <strong>CONTROLES</strong>
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Movimentar</span></div>
        <div><kbd>F</kbd><span>Interagir próximo</span></div>
        <div><span class="mouse-icon">◉</span><span>Clicar em objetos</span></div>
      </section>

      <section id="interaction-prompt" class="interaction-prompt" aria-live="polite">
        <div class="interaction-key">F</div>
        <div>
          <strong id="interaction-name">Objeto</strong>
          <span id="interaction-description">Interagir</span>
        </div>
      </section>

      <div id="game-toast" class="game-toast" role="status" aria-live="polite"></div>

      <div id="modal-backdrop" class="modal-backdrop" role="presentation">
        <section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="game-modal__header">
            <div>
              <span>INTERAÇÃO</span>
              <h2 id="modal-title">Objeto</h2>
            </div>
            <button id="modal-close" class="modal-close" type="button" aria-label="Fechar">×</button>
          </div>
          <div id="modal-body" class="game-modal__body"></div>
          <div id="modal-actions" class="game-modal__actions"></div>
        </section>
      </div>
    `;

    this.hudDay = this.requireElement("hud-day");
    this.hudTime = this.requireElement("hud-time");
    this.hudMoney = this.requireElement("hud-money");
    this.hudSubscribers = this.requireElement("hud-subscribers");
    this.hudViews = this.requireElement("hud-views");
    this.energyValue = this.requireElement("energy-value");
    this.hungerValue = this.requireElement("hunger-value");
    this.creativityValue = this.requireElement("creativity-value");
    this.energyBar = this.requireElement("energy-bar");
    this.hungerBar = this.requireElement("hunger-bar");
    this.creativityBar = this.requireElement("creativity-bar");
    this.interactionPrompt = this.requireElement("interaction-prompt");
    this.interactionName = this.requireElement("interaction-name");
    this.interactionDescription = this.requireElement("interaction-description");
    this.modalBackdrop = this.requireElement("modal-backdrop");
    this.modalTitle = this.requireElement("modal-title");
    this.modalBody = this.requireElement("modal-body");
    this.modalActions = this.requireElement("modal-actions");
    this.toast = this.requireElement("game-toast");

    this.requireElement("modal-close").addEventListener("click", () => {
      this.closeModal();
    });
  }

  private requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`Elemento de interface não encontrado: ${id}`);
    }

    return element;
  }
}

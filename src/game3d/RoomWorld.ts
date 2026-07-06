import * as THREE from "three";

import type { CollisionBox, InteractableDefinition } from "./types";

const FLOOR_Y = 0;

export class RoomWorld {
  public readonly interactables = new Map<string, InteractableDefinition>();
  public readonly colliders: CollisionBox[] = [];
  public readonly clickTargets: THREE.Object3D[] = [];

  private readonly highlightHelpers = new Map<string, THREE.BoxHelper>();
  private readonly markers = new Map<string, THREE.Mesh>();

  public constructor(private readonly scene: THREE.Scene) {
    this.buildRoom();
  }

  public update(time: number): void {
    this.markers.forEach((marker, id) => {
      const baseY = this.interactables.get(id)?.position.y ?? 0.25;
      marker.position.y = baseY + 0.3 + Math.sin(time * 3.2) * 0.08;
      marker.rotation.z = time * 0.8;
    });
  }

  public setHighlighted(id: string | null): void {
    this.highlightHelpers.forEach((helper, helperId) => {
      helper.visible = helperId === id;
    });

    this.markers.forEach((marker, markerId) => {
      marker.visible = markerId === id;
    });
  }

  public getInteractableIdFromObject(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;

    while (current) {
      const id = current.userData.interactableId as string | undefined;

      if (id) {
        return id;
      }

      current = current.parent;
    }

    return null;
  }

  private buildRoom(): void {
    this.createFloor();
    this.createWalls();
    this.createWindow();
    this.createDeskSetup();
    this.createBed();
    this.createFridge();
    this.createWardrobe();
    this.createShelf();
    this.createDoor();
    this.createPlant();
    this.createRug();
    this.createCeilingLamp();
  }

  private createFloor(): void {
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b735c,
      roughness: 0.92,
      metalness: 0
    });
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.24, 9),
      floorMaterial
    );
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(12, 12, 0x564536, 0x6e5845);
    grid.position.y = 0.012;
    grid.scale.z = 0.75;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.24;
    });
    this.scene.add(grid);
  }

  private createWalls(): void {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.9
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88
    });

    const backWall = this.box(12, 3.8, 0.22, wallMaterial);
    backWall.position.set(0, 1.9, -4.5);
    backWall.receiveShadow = true;

    const leftWall = this.box(0.22, 3.8, 9, wallMaterial);
    leftWall.position.set(-6, 1.9, 0);
    leftWall.receiveShadow = true;

    const backAccent = this.box(12, 0.85, 0.235, accentMaterial);
    backAccent.position.set(0, 0.55, -4.38);

    const leftAccent = this.box(0.235, 0.85, 9, accentMaterial);
    leftAccent.position.set(-5.88, 0.55, 0);

    this.scene.add(backWall, leftWall, backAccent, leftAccent);
  }

  private createWindow(): void {
    const group = new THREE.Group();
    group.position.set(-3.1, 2.35, -4.34);

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x78c7e8,
      transparent: true,
      opacity: 0.68,
      roughness: 0.15,
      transmission: 0.15
    });

    const glass = this.box(2.7, 1.65, 0.08, glassMaterial);
    group.add(glass);

    const top = this.box(2.95, 0.14, 0.16, frameMaterial);
    const bottom = top.clone();
    top.position.y = 0.9;
    bottom.position.y = -0.9;

    const left = this.box(0.14, 1.95, 0.16, frameMaterial);
    const right = left.clone();
    left.position.x = -1.48;
    right.position.x = 1.48;

    const vertical = this.box(0.1, 1.75, 0.14, frameMaterial);
    const horizontal = this.box(2.82, 0.1, 0.14, frameMaterial);

    group.add(top, bottom, left, right, vertical, horizontal);

    const skyTexture = this.createTextTexture("CREATOR CITY", "#8ddcff", "#355c7d");
    const skyline = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 1.6),
      new THREE.MeshBasicMaterial({ map: skyTexture })
    );
    skyline.position.z = -0.06;
    group.add(skyline);

    this.scene.add(group);
  }

  private createDeskSetup(): void {
    const root = new THREE.Group();
    root.position.set(2.9, 0, -3.55);

    const wood = new THREE.MeshStandardMaterial({
      color: 0x795548,
      roughness: 0.72
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.55,
      metalness: 0.12
    });
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x075985,
      emissiveIntensity: 0.85,
      roughness: 0.25
    });

    const desktop = this.box(3.4, 0.2, 1.25, wood);
    desktop.position.y = 1.08;
    desktop.castShadow = true;

    const legGeometry = new THREE.BoxGeometry(0.18, 1.05, 0.18);
    for (const x of [-1.45, 1.45]) {
      for (const z of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(legGeometry, dark);
        leg.position.set(x, 0.52, z);
        leg.castShadow = true;
        root.add(leg);
      }
    }

    const monitor = this.box(1.55, 0.95, 0.12, dark);
    monitor.position.set(0, 1.72, -0.18);
    monitor.rotation.y = Math.PI;
    monitor.castShadow = true;

    const screen = this.box(1.35, 0.75, 0.035, screenMaterial);
    screen.position.set(0, 1.72, -0.255);
    screen.rotation.y = Math.PI;

    const monitorTexture = this.createMonitorTexture();
    const monitorPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.65),
      new THREE.MeshBasicMaterial({ map: monitorTexture })
    );
    monitorPanel.position.set(0, 1.72, -0.278);
    monitorPanel.rotation.y = Math.PI;

    const stand = this.box(0.12, 0.5, 0.12, dark);
    stand.position.set(0, 1.27, -0.18);

    const standBase = this.box(0.62, 0.08, 0.34, dark);
    standBase.position.set(0, 1.11, -0.05);

    const keyboard = this.box(1.15, 0.07, 0.36, dark);
    keyboard.position.set(0, 1.23, 0.27);
    keyboard.rotation.x = -0.08;

    const mouse = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 10),
      dark
    );
    mouse.scale.set(1, 0.45, 1.35);
    mouse.position.set(0.83, 1.24, 0.25);

    const pcCase = this.box(0.52, 1.02, 0.82, dark);
    pcCase.position.set(1.21, 0.58, 0.04);
    pcCase.castShadow = true;

    const rgbRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 1.2
    });
    const rgbRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.035, 10, 24),
      rgbRingMaterial
    );
    rgbRing.position.set(1.21, 0.78, 0.46);

    const chair = this.createChair();
    chair.position.set(0, 0, 1.35);
    chair.rotation.y = Math.PI;

    root.add(
      desktop,
      monitor,
      screen,
      monitorPanel,
      stand,
      standBase,
      keyboard,
      mouse,
      pcCase,
      rgbRing,
      chair
    );
    this.scene.add(root);

    this.colliders.push({ minX: 1.15, maxX: 4.7, minZ: -4.35, maxZ: -2.75 });
    this.registerInteractable(
      "computer",
      "Computador",
      "Abrir estação de produção",
      root,
      new THREE.Vector3(2.9, 0, -2.75),
      1.9
    );
  }

  private createChair(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.72,
      metalness: 0.08
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
      metalness: 0.35
    });

    const seat = this.box(0.85, 0.18, 0.85, material);
    seat.position.y = 0.72;
    seat.castShadow = true;

    const back = this.box(0.85, 1.15, 0.18, material);
    back.position.set(0, 1.28, 0.35);
    back.rotation.x = -0.1;
    back.castShadow = true;

    const post = this.box(0.12, 0.65, 0.12, metal);
    post.position.y = 0.34;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.08, 12),
      metal
    );
    base.position.y = 0.08;

    group.add(seat, back, post, base);
    return group;
  }

  private createBed(): void {
    const root = new THREE.Group();
    root.position.set(-4.15, 0, -2.35);

    const frame = new THREE.MeshStandardMaterial({
      color: 0x4b352d,
      roughness: 0.84
    });
    const mattressMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.96
    });
    const blanketMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f6fa8,
      roughness: 0.92
    });

    const base = this.box(2.7, 0.35, 3.65, frame);
    base.position.y = 0.28;
    base.castShadow = true;

    const mattress = this.box(2.5, 0.32, 3.42, mattressMaterial);
    mattress.position.y = 0.58;
    mattress.castShadow = true;

    const blanket = this.box(2.52, 0.14, 2.15, blanketMaterial);
    blanket.position.set(0, 0.8, 0.48);
    blanket.castShadow = true;

    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.24, 0.72),
      mattressMaterial
    );
    pillow.position.set(0, 0.82, -1.15);
    pillow.castShadow = true;

    const headboard = this.box(2.75, 1.05, 0.18, frame);
    headboard.position.set(0, 0.68, -1.82);
    headboard.castShadow = true;

    root.add(base, mattress, blanket, pillow, headboard);
    this.scene.add(root);

    this.colliders.push({ minX: -5.65, maxX: -2.65, minZ: -4.3, maxZ: -0.35 });
    this.registerInteractable(
      "bed",
      "Cama",
      "Dormir e recuperar energia",
      root,
      new THREE.Vector3(-2.55, 0, -1.1),
      1.8
    );
  }

  private createFridge(): void {
    const root = new THREE.Group();
    root.position.set(4.95, 0, 2.75);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.42,
      metalness: 0.08
    });
    const detailMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.3
    });

    const body = this.box(1.1, 2.35, 1.05, bodyMaterial);
    body.position.y = 1.18;
    body.castShadow = true;

    const separator = this.box(1.03, 0.045, 0.03, detailMaterial);
    separator.position.set(0, 1.45, -0.54);

    const handleTop = this.box(0.06, 0.52, 0.08, detailMaterial);
    handleTop.position.set(0.38, 1.8, -0.58);

    const handleBottom = this.box(0.06, 0.42, 0.08, detailMaterial);
    handleBottom.position.set(0.38, 0.96, -0.58);

    root.add(body, separator, handleTop, handleBottom);
    this.scene.add(root);

    this.colliders.push({ minX: 4.25, maxX: 5.65, minZ: 2.05, maxZ: 3.45 });
    this.registerInteractable(
      "fridge",
      "Geladeira",
      "Preparar uma refeição por R$ 10",
      root,
      new THREE.Vector3(4.15, 0, 2.7),
      1.7
    );
  }

  private createWardrobe(): void {
    const root = new THREE.Group();
    root.position.set(-5.25, 0, 2.55);

    const wood = new THREE.MeshStandardMaterial({
      color: 0x6b4f3d,
      roughness: 0.82
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.35,
      metalness: 0.5
    });

    const body = this.box(1.15, 2.65, 2.15, wood);
    body.position.y = 1.32;
    body.castShadow = true;

    const divider = this.box(0.035, 2.48, 2.05, metal);
    divider.position.set(-0.59, 1.32, 0);
    divider.rotation.y = Math.PI / 2;

    const handleA = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 8),
      metal
    );
    handleA.position.set(0.59, 1.35, -0.18);

    const handleB = handleA.clone();
    handleB.position.z = 0.18;

    root.add(body, divider, handleA, handleB);
    this.scene.add(root);

    this.colliders.push({ minX: -5.9, maxX: -4.55, minZ: 1.35, maxZ: 3.75 });
    this.registerInteractable(
      "wardrobe",
      "Guarda-roupa",
      "Trocar a cor da roupa",
      root,
      new THREE.Vector3(-4.35, 0, 2.5),
      1.7
    );
  }

  private createShelf(): void {
    const root = new THREE.Group();
    root.position.set(0.1, 0, -4.18);

    const wood = new THREE.MeshStandardMaterial({
      color: 0x5b4636,
      roughness: 0.82
    });
    const bookColors = [0x0ea5e9, 0x8b5cf6, 0xf97316, 0x10b981, 0xef4444];

    const sideLeft = this.box(0.12, 2.4, 0.5, wood);
    sideLeft.position.set(-1.05, 1.2, 0);
    const sideRight = sideLeft.clone();
    sideRight.position.x = 1.05;
    root.add(sideLeft, sideRight);

    for (const y of [0.12, 0.82, 1.52, 2.22]) {
      const shelf = this.box(2.2, 0.12, 0.58, wood);
      shelf.position.y = y;
      root.add(shelf);
    }

    bookColors.forEach((color, index) => {
      const book = this.box(
        0.18,
        0.5 + (index % 2) * 0.08,
        0.36,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
      );
      book.position.set(-0.72 + index * 0.31, 1.16, 0.02);
      book.castShadow = true;
      root.add(book);
    });

    this.scene.add(root);
    this.colliders.push({ minX: -1.15, maxX: 1.35, minZ: -4.48, maxZ: -3.78 });
    this.registerInteractable(
      "shelf",
      "Estante",
      "Buscar inspiração nos livros",
      root,
      new THREE.Vector3(0.1, 0, -3.45),
      1.7
    );
  }

  private createDoor(): void {
    const root = new THREE.Group();
    root.position.set(-5.82, 0, 0.05);

    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x855d42,
      roughness: 0.8
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.35,
      metalness: 0.45
    });

    const door = this.box(0.16, 2.8, 1.65, doorMaterial);
    door.position.y = 1.4;
    door.castShadow = true;

    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 10),
      metal
    );
    knob.position.set(0.12, 1.35, -0.5);

    root.add(door, knob);
    this.scene.add(root);

    this.colliders.push({ minX: -5.95, maxX: -5.55, minZ: -0.95, maxZ: 1.05 });
    this.registerInteractable(
      "door",
      "Porta",
      "Verificar a saída do quarto",
      root,
      new THREE.Vector3(-5.15, 0, 0.05),
      1.45
    );
  }

  private createPlant(): void {
    const group = new THREE.Group();
    group.position.set(3.75, 0, 3.75);

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.28, 0.55, 16),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 })
    );
    pot.position.y = 0.28;
    pot.castShadow = true;

    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.9
    });
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.82
    });

    for (let index = 0; index < 5; index += 1) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 0.85, 8),
        stemMaterial
      );
      stem.position.set((index - 2) * 0.08, 0.88, 0);
      stem.rotation.z = (index - 2) * 0.1;

      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 10),
        leafMaterial
      );
      leaf.scale.set(0.65, 1.25, 0.35);
      leaf.position.set((index - 2) * 0.16, 1.35, (index % 2) * 0.12);
      leaf.rotation.z = (index - 2) * 0.32;
      leaf.castShadow = true;

      group.add(stem, leaf);
    }

    group.add(pot);
    this.scene.add(group);
    this.colliders.push({ minX: 3.25, maxX: 4.25, minZ: 3.2, maxZ: 4.25 });
  }

  private createRug(): void {
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.35),
      new THREE.MeshStandardMaterial({
        color: 0x315c71,
        roughness: 0.96,
        side: THREE.DoubleSide
      })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = Math.PI / 10;
    rug.position.set(0.6, FLOOR_Y + 0.02, 1.25);
    rug.receiveShadow = true;
    this.scene.add(rug);
  }

  private createCeilingLamp(): void {
    const group = new THREE.Group();
    group.position.set(0.4, 3.25, 0.3);

    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x111827 })
    );
    cable.position.y = 0.25;

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.45, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.7,
        side: THREE.DoubleSide
      })
    );
    shade.position.y = -0.18;
    shade.rotation.x = Math.PI;

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfff4cc,
        emissive: 0xffd966,
        emissiveIntensity: 2
      })
    );
    bulb.position.y = -0.35;

    group.add(cable, shade, bulb);
    this.scene.add(group);
  }

  private registerInteractable(
    id: string,
    label: string,
    prompt: string,
    root: THREE.Object3D,
    position: THREE.Vector3,
    maxDistance: number
  ): void {
    root.userData.interactableId = id;
    root.traverse((child) => {
      child.userData.interactableId = id;
    });

    const definition: InteractableDefinition = {
      id,
      label,
      prompt,
      root,
      position,
      maxDistance
    };

    this.interactables.set(id, definition);
    this.clickTargets.push(root);

    const helper = new THREE.BoxHelper(root, 0x42e8b4);
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.9;
    helper.renderOrder = 10;
    helper.visible = false;
    this.scene.add(helper);
    this.highlightHelpers.set(id, helper);

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.045, 8, 28),
      new THREE.MeshBasicMaterial({
        color: 0x42e8b4,
        transparent: true,
        opacity: 0.9,
        depthTest: false
      })
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.copy(position);
    marker.position.y = position.y + 0.3;
    marker.visible = false;
    marker.renderOrder = 11;
    this.scene.add(marker);
    this.markers.set(id, marker);
  }

  private box(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createMonitorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 280;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Não foi possível criar a textura do monitor.");
    }

    const gradient = context.createLinearGradient(0, 0, 512, 280);
    gradient.addColorStop(0, "#071425");
    gradient.addColorStop(1, "#0c4a6e");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 280);

    context.fillStyle = "#42e8b4";
    context.font = "700 40px Arial";
    context.fillText("CREATOR LIFE", 38, 70);

    context.fillStyle = "#dce8f5";
    context.font = "600 26px Arial";
    context.fillText("0 inscritos", 38, 130);

    context.fillStyle = "#6ee7f9";
    context.fillRect(38, 165, 320, 16);
    context.fillStyle = "#1e293b";
    context.fillRect(38, 205, 425, 10);
    context.fillRect(38, 230, 355, 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createTextTexture(
    title: string,
    topColor: string,
    bottomColor: string
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 300;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Não foi possível criar a textura procedural.");
    }

    const gradient = context.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 300);

    context.fillStyle = "rgba(15, 23, 42, 0.55)";
    for (let x = 0; x < 512; x += 55) {
      const height = 45 + ((x * 37) % 130);
      context.fillRect(x, 300 - height, 38, height);
    }

    context.fillStyle = "rgba(255,255,255,0.9)";
    context.font = "700 34px Arial";
    context.fillText(title, 26, 52);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}

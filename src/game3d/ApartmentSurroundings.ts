import * as THREE from "three";

/**
 * Expande visualmente o quarto para um apartamento em corte isométrico.
 * Todos os elementos deste grupo são decorativos: não registram colisões,
 * interações ou novas áreas jogáveis.
 */
export class ApartmentSurroundings {
  private readonly root = new THREE.Group();
  private readonly materials = this.createMaterials();

  public constructor(private readonly scene: THREE.Scene) {
    this.root.name = "decorative-apartment-surroundings";
    this.root.userData.decorativeOnly = true;
    this.scene.add(this.root);

    this.createFoundation();
    this.createAdditionalFloors();
    this.createCutawayWalls();
    this.createLivingRoom();
    this.createDiningArea();
    this.createKitchen();
    this.createBathroom();
    this.createHallway();
    this.createBalcony();
    this.createArchitecturalDetails();
  }

  private createMaterials() {
    return {
      foundation: new THREE.MeshStandardMaterial({
        color: 0x3c342f,
        roughness: 0.96
      }),
      livingFloor: new THREE.MeshStandardMaterial({
        color: 0xa68a6d,
        roughness: 0.9
      }),
      kitchenFloor: new THREE.MeshStandardMaterial({
        color: 0xc4c1b8,
        roughness: 0.86
      }),
      bathroomFloor: new THREE.MeshStandardMaterial({
        color: 0xb8c4c7,
        roughness: 0.82
      }),
      hallwayFloor: new THREE.MeshStandardMaterial({
        color: 0x93775e,
        roughness: 0.92
      }),
      wall: new THREE.MeshStandardMaterial({
        color: 0xd9dde1,
        roughness: 0.92
      }),
      wallWarm: new THREE.MeshStandardMaterial({
        color: 0xc9b5a4,
        roughness: 0.9
      }),
      trim: new THREE.MeshStandardMaterial({
        color: 0x5c4a40,
        roughness: 0.84
      }),
      dark: new THREE.MeshStandardMaterial({
        color: 0x25272d,
        roughness: 0.72,
        metalness: 0.08
      }),
      metal: new THREE.MeshStandardMaterial({
        color: 0x59616a,
        roughness: 0.48,
        metalness: 0.52
      }),
      wood: new THREE.MeshStandardMaterial({
        color: 0x76513c,
        roughness: 0.78
      }),
      woodLight: new THREE.MeshStandardMaterial({
        color: 0xa77a58,
        roughness: 0.8
      }),
      fabric: new THREE.MeshStandardMaterial({
        color: 0x667481,
        roughness: 0.98
      }),
      fabricAccent: new THREE.MeshStandardMaterial({
        color: 0xa74742,
        roughness: 0.96
      }),
      white: new THREE.MeshStandardMaterial({
        color: 0xf0f1ef,
        roughness: 0.78
      }),
      ceramic: new THREE.MeshStandardMaterial({
        color: 0xe9efef,
        roughness: 0.38
      }),
      appliance: new THREE.MeshStandardMaterial({
        color: 0x30343a,
        roughness: 0.42,
        metalness: 0.24
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xb9dbe3,
        transparent: true,
        opacity: 0.32,
        roughness: 0.12,
        transmission: 0.28,
        side: THREE.DoubleSide
      }),
      plant: new THREE.MeshStandardMaterial({
        color: 0x3c8b52,
        roughness: 0.9
      }),
      soil: new THREE.MeshStandardMaterial({
        color: 0x4a3024,
        roughness: 1
      }),
      terracotta: new THREE.MeshStandardMaterial({
        color: 0xb45b36,
        roughness: 0.9
      }),
      rug: new THREE.MeshStandardMaterial({
        color: 0x8a3f3b,
        roughness: 1
      }),
      balcony: new THREE.MeshStandardMaterial({
        color: 0x8b8e8d,
        roughness: 0.94
      })
    };
  }

  private createFoundation(): void {
    const slab = this.box(17.5, 0.44, 16.3, this.materials.foundation);
    slab.position.set(2.25, -0.36, 3.05);
    slab.receiveShadow = true;
    this.root.add(slab);

    const plinth = this.box(17.9, 0.34, 16.7, this.materials.trim);
    plinth.position.set(2.25, -0.72, 3.05);
    plinth.receiveShadow = true;
    this.root.add(plinth);
  }

  private createAdditionalFloors(): void {
    const living = this.box(10.45, 0.22, 6.15, this.materials.livingFloor);
    living.position.set(-0.78, -0.11, 7.56);
    living.receiveShadow = true;

    const kitchen = this.box(5.25, 0.23, 8.55, this.materials.kitchenFloor);
    kitchen.position.set(8.15, -0.105, 6.05);
    kitchen.receiveShadow = true;

    const bathroom = this.box(4.75, 0.24, 6.2, this.materials.bathroomFloor);
    bathroom.position.set(8.35, -0.1, -1.38);
    bathroom.receiveShadow = true;

    const hallway = this.box(1.65, 0.225, 9.05, this.materials.hallwayFloor);
    hallway.position.set(5.78, -0.108, 0);
    hallway.receiveShadow = true;

    this.root.add(living, kitchen, bathroom, hallway);
    this.addFloorLines(living, 10, 6, 0x725e4c, 0.2);
    this.addFloorLines(kitchen, 5, 8, 0x8b8f8e, 0.17);
    this.addFloorLines(bathroom, 5, 6, 0x879496, 0.18);
  }

  private createCutawayWalls(): void {
    const { wall, wallWarm, trim } = this.materials;

    const leftLivingWall = this.box(0.22, 2.9, 6.15, wallWarm);
    leftLivingWall.position.set(-6.02, 1.45, 7.56);

    const kitchenBackWall = this.box(5.3, 2.9, 0.22, wall);
    kitchenBackWall.position.set(8.13, 1.45, 10.65);

    const bathroomBackWall = this.box(4.78, 2.9, 0.22, wall);
    bathroomBackWall.position.set(8.35, 1.45, -4.48);

    const bathroomRightWall = this.box(0.22, 1.05, 6.2, wall);
    bathroomRightWall.position.set(10.74, 0.525, -1.38);

    const apartmentFrontWall = this.box(16.7, 0.72, 0.22, wallWarm);
    apartmentFrontWall.position.set(2.32, 0.36, 10.7);

    const apartmentRightWall = this.box(0.22, 0.72, 15.2, wallWarm);
    apartmentRightWall.position.set(10.77, 0.36, 3.05);

    const bathroomDividerA = this.box(0.22, 1.15, 2.25, wall);
    bathroomDividerA.position.set(6.03, 0.575, -3.35);
    const bathroomDividerB = this.box(0.22, 1.15, 1.95, wall);
    bathroomDividerB.position.set(6.03, 0.575, 1.02);

    const kitchenDivider = this.box(3.05, 0.78, 0.18, wallWarm);
    kitchenDivider.position.set(9.2, 0.39, 2.15);

    const trims = [
      this.box(0.08, 0.18, 6.08, trim),
      this.box(5.18, 0.18, 0.08, trim),
      this.box(4.66, 0.18, 0.08, trim),
      this.box(16.55, 0.16, 0.08, trim)
    ];
    trims[0].position.set(-5.88, 0.09, 7.56);
    trims[1].position.set(8.13, 0.09, 10.52);
    trims[2].position.set(8.35, 0.09, -4.35);
    trims[3].position.set(2.32, 0.08, 10.56);

    this.root.add(
      leftLivingWall,
      kitchenBackWall,
      bathroomBackWall,
      bathroomRightWall,
      apartmentFrontWall,
      apartmentRightWall,
      bathroomDividerA,
      bathroomDividerB,
      kitchenDivider,
      ...trims
    );
  }

  private createLivingRoom(): void {
    const sofa = new THREE.Group();
    sofa.position.set(-3.25, 0, 8.25);
    sofa.rotation.y = Math.PI;

    const seatBase = this.box(3.5, 0.42, 1.25, this.materials.fabric);
    seatBase.position.y = 0.45;
    seatBase.castShadow = true;

    const seatCushion = this.box(3.12, 0.28, 1.08, this.materials.fabric);
    seatCushion.position.set(0, 0.76, -0.02);
    seatCushion.castShadow = true;

    const back = this.box(3.5, 1.18, 0.32, this.materials.fabric);
    back.position.set(0, 1.12, 0.58);
    back.rotation.x = -0.06;
    back.castShadow = true;

    const armLeft = this.box(0.35, 0.75, 1.32, this.materials.fabric);
    const armRight = armLeft.clone();
    armLeft.position.set(-1.72, 0.72, 0);
    armRight.position.set(1.72, 0.72, 0);

    const pillowA = this.box(0.72, 0.64, 0.24, this.materials.fabricAccent);
    const pillowB = this.box(0.72, 0.64, 0.24, this.materials.white);
    pillowA.position.set(-0.95, 1.15, 0.37);
    pillowB.position.set(0.92, 1.15, 0.37);
    pillowA.rotation.z = -0.12;
    pillowB.rotation.z = 0.1;

    sofa.add(
      seatBase,
      seatCushion,
      back,
      armLeft,
      armRight,
      pillowA,
      pillowB
    );

    const rug = this.box(4.7, 0.04, 3.0, this.materials.rug);
    rug.position.set(-2.1, 0.035, 6.55);
    rug.receiveShadow = true;

    const coffeeTable = new THREE.Group();
    coffeeTable.position.set(-1.75, 0, 6.5);
    const top = this.box(2.15, 0.14, 1.18, this.materials.woodLight);
    top.position.y = 0.52;
    top.castShadow = true;
    for (const x of [-0.82, 0.82]) {
      for (const z of [-0.35, 0.35]) {
        const leg = this.box(0.11, 0.5, 0.11, this.materials.dark);
        leg.position.set(x, 0.25, z);
        coffeeTable.add(leg);
      }
    }
    const book = this.box(0.55, 0.07, 0.38, this.materials.fabricAccent);
    book.position.set(-0.48, 0.63, 0.12);
    book.rotation.y = 0.16;
    coffeeTable.add(top, book);

    const media = new THREE.Group();
    media.position.set(2.42, 0, 5.38);
    media.rotation.y = -Math.PI / 2;
    const mediaUnit = this.box(2.55, 0.58, 0.5, this.materials.wood);
    mediaUnit.position.y = 0.31;
    const tv = this.box(2.35, 1.28, 0.12, this.materials.dark);
    tv.position.set(0, 1.38, 0);
    const tvScreen = this.box(
      2.14,
      1.08,
      0.035,
      new THREE.MeshStandardMaterial({
        color: 0x101722,
        emissive: 0x162c42,
        emissiveIntensity: 0.35,
        roughness: 0.26
      })
    );
    tvScreen.position.set(0, 1.38, -0.075);
    media.add(mediaUnit, tv, tvScreen);

    const lamp = this.createFloorLamp();
    lamp.position.set(-5.2, 0, 5.35);

    this.root.add(sofa, rug, coffeeTable, media, lamp);
  }

  private createDiningArea(): void {
    const group = new THREE.Group();
    group.position.set(2.15, 0, 8.05);

    const tabletop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.22, 1.22, 0.16, 24),
      this.materials.woodLight
    );
    tabletop.position.y = 1.02;
    tabletop.castShadow = true;

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.32, 0.96, 14),
      this.materials.dark
    );
    pedestal.position.y = 0.5;

    group.add(tabletop, pedestal);

    const chairPositions = [
      [0, 1.75, Math.PI],
      [0, -1.75, 0],
      [1.75, 0, -Math.PI / 2],
      [-1.75, 0, Math.PI / 2]
    ] as const;
    chairPositions.forEach(([x, z, rotation]) => {
      const chair = this.createDiningChair();
      chair.position.set(x, 0, z);
      chair.rotation.y = rotation;
      group.add(chair);
    });

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.22, 0.14, 18),
      this.materials.ceramic
    );
    bowl.position.y = 1.18;
    group.add(bowl);

    this.root.add(group);
  }

  private createKitchen(): void {
    const group = new THREE.Group();

    const backCounter = this.createCounterRun(4.85, 0.72);
    backCounter.position.set(8.15, 0, 10.05);

    const sideCounter = this.createCounterRun(5.6, 0.72);
    sideCounter.position.set(10.2, 0, 6.05);
    sideCounter.rotation.y = Math.PI / 2;

    const fridge = this.box(1.2, 2.45, 1.05, this.materials.appliance);
    fridge.position.set(9.65, 1.225, 2.95);
    fridge.castShadow = true;
    const fridgeLine = this.box(0.03, 2.1, 0.88, this.materials.metal);
    fridgeLine.position.set(9.03, 1.25, 2.95);

    const island = new THREE.Group();
    island.position.set(7.25, 0, 6.55);
    const islandBase = this.box(2.75, 0.88, 1.25, this.materials.wood);
    islandBase.position.y = 0.44;
    const islandTop = this.box(3.0, 0.12, 1.48, this.materials.white);
    islandTop.position.y = 0.94;
    islandTop.castShadow = true;
    island.add(islandBase, islandTop);

    const stools = [-0.82, 0.82].map((x) => {
      const stool = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.14, 16),
        this.materials.dark
      );
      seat.position.y = 0.78;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.1, 0.72, 10),
        this.materials.metal
      );
      leg.position.y = 0.38;
      stool.position.set(x, 0, -1.1);
      stool.add(seat, leg);
      return stool;
    });
    island.add(...stools);

    const cooktop = this.box(1.18, 0.035, 0.62, this.materials.dark);
    cooktop.position.set(8.15, 1.02, 9.72);
    for (const x of [-0.34, 0.34]) {
      for (const z of [-0.16, 0.16]) {
        const burner = new THREE.Mesh(
          new THREE.TorusGeometry(0.13, 0.018, 8, 18),
          this.materials.metal
        );
        burner.rotation.x = Math.PI / 2;
        burner.position.set(8.15 + x, 1.045, 9.72 + z);
        group.add(burner);
      }
    }

    const sink = this.box(0.85, 0.05, 0.55, this.materials.metal);
    sink.position.set(10.0, 1.02, 6.15);
    const faucet = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.025, 8, 18, Math.PI),
      this.materials.metal
    );
    faucet.position.set(9.77, 1.25, 6.15);
    faucet.rotation.y = Math.PI / 2;

    group.add(
      backCounter,
      sideCounter,
      fridge,
      fridgeLine,
      island,
      cooktop,
      sink,
      faucet
    );
    this.root.add(group);
  }

  private createBathroom(): void {
    const group = new THREE.Group();

    const showerBase = this.box(1.85, 0.15, 1.75, this.materials.ceramic);
    showerBase.position.set(9.3, 0.075, -3.15);
    const showerGlassA = this.box(1.75, 1.95, 0.045, this.materials.glass);
    showerGlassA.position.set(9.3, 1.05, -2.3);
    const showerGlassB = this.box(0.045, 1.95, 1.72, this.materials.glass);
    showerGlassB.position.set(8.43, 1.05, -3.15);
    const showerHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16),
      this.materials.metal
    );
    showerHead.rotation.z = Math.PI / 2;
    showerHead.position.set(10.52, 2.1, -3.35);

    const toilet = new THREE.Group();
    toilet.position.set(7.2, 0, 0.22);
    const toiletBase = this.box(0.72, 0.5, 0.9, this.materials.ceramic);
    toiletBase.position.y = 0.25;
    const toiletSeat = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.09, 10, 24),
      this.materials.ceramic
    );
    toiletSeat.rotation.x = Math.PI / 2;
    toiletSeat.scale.z = 1.28;
    toiletSeat.position.set(0, 0.55, -0.12);
    const cistern = this.box(0.72, 0.7, 0.32, this.materials.ceramic);
    cistern.position.set(0, 0.76, 0.33);
    toilet.add(toiletBase, toiletSeat, cistern);

    const vanity = new THREE.Group();
    vanity.position.set(9.42, 0, 0.55);
    const cabinet = this.box(1.65, 0.8, 0.62, this.materials.woodLight);
    cabinet.position.y = 0.4;
    const vanityTop = this.box(1.78, 0.1, 0.72, this.materials.white);
    vanityTop.position.y = 0.84;
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.31, 0.16, 20),
      this.materials.ceramic
    );
    basin.position.y = 0.96;
    const mirror = this.box(
      1.35,
      1.15,
      0.045,
      new THREE.MeshStandardMaterial({
        color: 0xb8c9d1,
        roughness: 0.12,
        metalness: 0.35
      })
    );
    mirror.position.set(0, 1.68, 0.34);
    vanity.add(cabinet, vanityTop, basin, mirror);

    const bathMat = this.box(1.35, 0.035, 0.75, this.materials.fabricAccent);
    bathMat.position.set(8.85, 0.03, -1.65);

    group.add(
      showerBase,
      showerGlassA,
      showerGlassB,
      showerHead,
      toilet,
      vanity,
      bathMat
    );
    this.root.add(group);
  }

  private createHallway(): void {
    const runner = this.box(1.05, 0.035, 6.8, this.materials.rug);
    runner.position.set(5.72, 0.03, -0.15);

    const consoleTable = new THREE.Group();
    consoleTable.position.set(5.48, 0, 3.22);
    const top = this.box(0.45, 0.1, 1.45, this.materials.woodLight);
    top.position.y = 0.88;
    for (const z of [-0.55, 0.55]) {
      const leg = this.box(0.09, 0.84, 0.09, this.materials.dark);
      leg.position.set(0, 0.42, z);
      consoleTable.add(leg);
    }
    const frame = this.box(0.08, 0.92, 0.82, this.materials.dark);
    frame.position.set(-0.25, 1.55, 0);
    frame.rotation.z = Math.PI / 2;
    consoleTable.add(top, frame);

    const plant = this.createPlant(0.82);
    plant.position.set(5.6, 0, -3.55);

    this.root.add(runner, consoleTable, plant);
  }

  private createBalcony(): void {
    const slab = this.box(5.2, 0.22, 1.7, this.materials.balcony);
    slab.position.set(-3.15, -0.1, 11.72);
    slab.receiveShadow = true;

    const railMaterial = this.materials.metal;
    const topRail = this.box(5.0, 0.08, 0.08, railMaterial);
    topRail.position.set(-3.15, 1.05, 12.52);
    for (const x of [-5.5, -4.75, -4, -3.25, -2.5, -1.75, -1]) {
      const post = this.box(0.055, 1.0, 0.055, railMaterial);
      post.position.set(x, 0.52, 12.52);
      this.root.add(post);
    }

    const chairA = this.createBalconyChair();
    chairA.position.set(-4.35, 0, 11.65);
    chairA.rotation.y = Math.PI;
    const chairB = this.createBalconyChair();
    chairB.position.set(-2.2, 0, 11.65);
    chairB.rotation.y = Math.PI;
    const smallTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.1, 18),
      this.materials.woodLight
    );
    smallTable.position.set(-3.25, 0.62, 11.75);
    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 0.58, 10),
      railMaterial
    );
    tableLeg.position.set(-3.25, 0.3, 11.75);

    const planterA = this.createPlant(0.6);
    planterA.position.set(-5.55, 0, 11.72);
    const planterB = this.createPlant(0.55);
    planterB.position.set(-0.82, 0, 11.72);

    this.root.add(
      slab,
      topRail,
      chairA,
      chairB,
      smallTable,
      tableLeg,
      planterA,
      planterB
    );
  }

  private createArchitecturalDetails(): void {
    const doorFrameMaterial = this.materials.trim;

    const hallwayFrame = new THREE.Group();
    hallwayFrame.position.set(5.92, 0, 2.35);
    const left = this.box(0.12, 2.55, 0.12, doorFrameMaterial);
    const right = left.clone();
    left.position.set(0, 1.275, -0.85);
    right.position.set(0, 1.275, 0.85);
    const top = this.box(0.12, 0.12, 1.82, doorFrameMaterial);
    top.position.set(0, 2.5, 0);
    hallwayFrame.add(left, right, top);

    const kitchenPendant = this.createPendantLight();
    kitchenPendant.position.set(7.25, 2.9, 6.55);
    const diningPendant = this.createPendantLight();
    diningPendant.position.set(2.15, 3.0, 8.05);
    diningPendant.scale.setScalar(1.12);

    const artA = this.createWallArt(1.35, 0.95, 0x6d4b43, 0xc98e74);
    artA.position.set(-5.87, 1.72, 7.25);
    artA.rotation.y = Math.PI / 2;
    const artB = this.createWallArt(1.1, 0.82, 0x334e5b, 0x9eb6b3);
    artB.position.set(7.7, 1.75, 10.52);

    this.root.add(hallwayFrame, kitchenPendant, diningPendant, artA, artB);
  }

  private createCounterRun(width: number, depth: number): THREE.Group {
    const group = new THREE.Group();
    const base = this.box(width, 0.88, depth, this.materials.wood);
    base.position.y = 0.44;
    const top = this.box(width + 0.12, 0.1, depth + 0.12, this.materials.white);
    top.position.y = 0.94;
    top.castShadow = true;
    group.add(base, top);

    const doorCount = Math.max(2, Math.floor(width / 0.75));
    for (let index = 1; index < doorCount; index += 1) {
      const seam = this.box(0.018, 0.64, depth + 0.015, this.materials.dark);
      seam.position.set(-width / 2 + (width / doorCount) * index, 0.42, 0);
      group.add(seam);
    }
    return group;
  }

  private createDiningChair(): THREE.Group {
    const group = new THREE.Group();
    const seat = this.box(0.72, 0.13, 0.72, this.materials.woodLight);
    seat.position.y = 0.68;
    const back = this.box(0.72, 0.78, 0.12, this.materials.woodLight);
    back.position.set(0, 1.08, 0.32);
    const legPositions = [
      [-0.27, -0.27],
      [0.27, -0.27],
      [-0.27, 0.27],
      [0.27, 0.27]
    ];
    legPositions.forEach(([x, z]) => {
      const leg = this.box(0.08, 0.65, 0.08, this.materials.dark);
      leg.position.set(x, 0.325, z);
      group.add(leg);
    });
    group.add(seat, back);
    return group;
  }

  private createBalconyChair(): THREE.Group {
    const group = new THREE.Group();
    const seat = this.box(0.82, 0.09, 0.78, this.materials.woodLight);
    seat.position.y = 0.58;
    const back = this.box(0.82, 0.82, 0.08, this.materials.woodLight);
    back.position.set(0, 0.98, 0.34);
    back.rotation.x = -0.1;
    for (const x of [-0.32, 0.32]) {
      for (const z of [-0.28, 0.28]) {
        const leg = this.box(0.07, 0.56, 0.07, this.materials.metal);
        leg.position.set(x, 0.28, z);
        group.add(leg);
      }
    }
    group.add(seat, back);
    return group;
  }

  private createFloorLamp(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16),
      this.materials.dark
    );
    base.position.y = 0.04;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 2.1, 10),
      this.materials.metal
    );
    pole.position.y = 1.08;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.72, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xd8c5a7,
        roughness: 0.88,
        side: THREE.DoubleSide
      })
    );
    shade.position.y = 2.18;
    shade.rotation.x = Math.PI;
    group.add(base, pole, shade);
    return group;
  }

  private createPendantLight(): THREE.Group {
    const group = new THREE.Group();
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.45, 8),
      this.materials.dark
    );
    cable.position.y = -0.7;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.48, 18, 1, true),
      this.materials.dark
    );
    shade.position.y = -1.5;
    shade.rotation.x = Math.PI;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffe5ad,
        emissive: 0xffcf72,
        emissiveIntensity: 0.9
      })
    );
    bulb.position.y = -1.54;
    group.add(cable, shade, bulb);
    return group;
  }

  private createPlant(scale: number): THREE.Group {
    const group = new THREE.Group();
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.25, 0.52, 14),
      this.materials.terracotta
    );
    pot.position.y = 0.26;
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14),
      this.materials.soil
    );
    soil.position.y = 0.54;
    group.add(pot, soil);

    for (let index = 0; index < 6; index += 1) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 10, 8),
        this.materials.plant
      );
      const angle = (index / 6) * Math.PI * 2;
      leaf.scale.set(0.45, 1.2, 0.34);
      leaf.position.set(
        Math.cos(angle) * 0.2,
        0.78 + (index % 2) * 0.18,
        Math.sin(angle) * 0.2
      );
      leaf.rotation.z = Math.cos(angle) * 0.55;
      leaf.rotation.x = Math.sin(angle) * 0.42;
      group.add(leaf);
    }

    group.scale.setScalar(scale);
    return group;
  }

  private createWallArt(
    width: number,
    height: number,
    background: number,
    accent: number
  ): THREE.Group {
    const group = new THREE.Group();
    const frame = this.box(width + 0.12, height + 0.12, 0.07, this.materials.dark);
    const canvas = this.box(
      width,
      height,
      0.035,
      new THREE.MeshStandardMaterial({ color: background, roughness: 0.86 })
    );
    canvas.position.z = -0.055;
    const shape = this.box(
      width * 0.42,
      height * 0.18,
      0.025,
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.82 })
    );
    shape.position.set(width * 0.12, -height * 0.1, -0.082);
    shape.rotation.z = -0.35;
    group.add(frame, canvas, shape);
    return group;
  }

  private addFloorLines(
    floor: THREE.Mesh,
    columns: number,
    rows: number,
    color: number,
    opacity: number
  ): void {
    const geometry = floor.geometry as THREE.BoxGeometry;
    const { width, depth } = geometry.parameters;
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity
    });

    const points: THREE.Vector3[] = [];
    for (let column = 1; column < columns; column += 1) {
      const x = -width / 2 + (width / columns) * column;
      points.push(
        new THREE.Vector3(x, 0.125, -depth / 2),
        new THREE.Vector3(x, 0.125, depth / 2)
      );
    }
    for (let row = 1; row < rows; row += 1) {
      const z = -depth / 2 + (depth / rows) * row;
      points.push(
        new THREE.Vector3(-width / 2, 0.125, z),
        new THREE.Vector3(width / 2, 0.125, z)
      );
    }

    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      material
    );
    lines.position.copy(floor.position);
    lines.position.y = 0.015;
    this.root.add(lines);
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
    mesh.castShadow = height > 0.25;
    mesh.receiveShadow = true;
    return mesh;
  }
}

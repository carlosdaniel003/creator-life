import * as THREE from "three";

import type { ProgressionSave } from "../game/types";

export class RoomProgressionVisuals {
  private readonly groups = new Map<string, THREE.Group>();

  public constructor(private readonly scene: THREE.Scene) {
    this.buildComputerUpgrades();
    this.buildRoomUpgrades();
  }

  public apply(save: ProgressionSave): void {
    this.setLevel("cpu", save.equipment.cpu);
    this.setLevel("gpu", save.equipment.gpu);
    this.setLevel("monitor", save.equipment.monitor);
    this.setLevel("microphone", save.equipment.microphone);
    this.setLevel("camera", save.equipment.camera);
    this.setLevel("storage", save.equipment.storage);
    this.setLevel("bed", save.room.bed);
    this.setLevel("chair", save.room.chair);
    this.setLevel("desk", save.room.desk);
    this.setLevel("lighting", save.room.lighting);
    this.setLevel("acoustic", save.room.acoustic);
    this.setLevel("decor", save.room.decor);
  }

  private setLevel(id: string, level: number): void {
    for (let index = 1; index <= 3; index += 1) {
      const group = this.groups.get(`${id}-${index}`);
      if (group) group.visible = index <= level;
    }
  }

  private buildComputerUpgrades(): void {
    this.addGroup("cpu-1", this.makeCaseBadge(0xef4444, 0.13), 4.13, 0.8, -3.07);
    this.addGroup("cpu-2", this.makeCaseBadge(0xff0000, 0.19), 4.13, 0.52, -3.07);
    this.addGroup("cpu-3", this.makeCaseBadge(0xffffff, 0.24), 4.13, 1.03, -3.07);

    const gpuFanOne = this.makeFanPanel(1, 0xff0000);
    this.addGroup("gpu-1", gpuFanOne, 4.13, 0.62, -3.05);
    const gpuFanTwo = this.makeFanPanel(2, 0xff3131);
    this.addGroup("gpu-2", gpuFanTwo, 4.13, 0.62, -3.04);
    const gpuFanThree = this.makeFanPanel(3, 0xffffff);
    this.addGroup("gpu-3", gpuFanThree, 4.13, 0.62, -3.03);

    const monitorAccent = this.box(1.52, 0.035, 0.05, 0xff0000, true);
    monitorAccent.position.y = 0.46;
    const monitorAccentGroup = new THREE.Group();
    monitorAccentGroup.add(monitorAccent);
    this.addGroup("monitor-1", monitorAccentGroup, 2.9, 1.72, -3.29);

    const colorStrip = this.box(1.64, 0.045, 0.045, 0xff0000, true);
    const colorStripGroup = new THREE.Group();
    colorStripGroup.add(colorStrip);
    this.addGroup("monitor-2", colorStripGroup, 2.9, 1.2, -3.28);

    const secondMonitor = new THREE.Group();
    const frame = this.box(1.2, 0.78, 0.1, 0x171717);
    const screen = this.box(1.04, 0.62, 0.025, 0xffffff, true);
    screen.position.z = 0.065;
    const redLine = this.box(0.88, 0.065, 0.02, 0xff0000, true);
    redLine.position.set(0, 0.18, 0.085);
    const stand = this.box(0.09, 0.42, 0.09, 0x202020);
    stand.position.y = -0.58;
    secondMonitor.add(frame, screen, redLine, stand);
    this.addGroup("monitor-3", secondMonitor, 3.82, 1.68, -3.36);

    const mic = new THREE.Group();
    const boom = this.box(0.06, 0.8, 0.06, 0x202020);
    boom.rotation.z = -0.75;
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.3, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.45 })
    );
    capsule.position.set(0.3, 0.28, 0);
    capsule.rotation.z = Math.PI / 2;
    mic.add(boom, capsule);
    this.addGroup("microphone-1", mic, 2.1, 1.55, -2.95);

    const popFilter = new THREE.Mesh(
      new THREE.CircleGeometry(0.17, 24),
      new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide })
    );
    const popGroup = new THREE.Group();
    popFilter.rotation.y = Math.PI / 2;
    popGroup.add(popFilter);
    this.addGroup("microphone-2", popGroup, 2.52, 1.82, -2.91);

    const shockMount = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.025, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 })
    );
    const shockGroup = new THREE.Group();
    shockMount.rotation.y = Math.PI / 2;
    shockGroup.add(shockMount);
    this.addGroup("microphone-3", shockGroup, 2.41, 1.82, -2.91);

    const camera = new THREE.Group();
    const cameraBody = this.box(0.36, 0.22, 0.18, 0x181818);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.095, 0.13, 18),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.14;
    camera.add(cameraBody, lens);
    this.addGroup("camera-1", camera, 2.9, 2.33, -3.31);

    const cameraLight = new THREE.PointLight(0xffe9da, 5, 2.2, 2);
    const cameraLightGroup = new THREE.Group();
    cameraLight.position.z = 0.2;
    cameraLightGroup.add(cameraLight);
    this.addGroup("camera-2", cameraLightGroup, 2.9, 2.32, -3.1);

    const tally = this.box(0.07, 0.05, 0.03, 0xff0000, true);
    const tallyGroup = new THREE.Group();
    tallyGroup.add(tally);
    this.addGroup("camera-3", tallyGroup, 2.9, 2.46, -3.15);

    const drive = this.box(0.42, 0.12, 0.28, 0x303030);
    const driveGroup = new THREE.Group();
    driveGroup.add(drive);
    this.addGroup("storage-1", driveGroup, 3.7, 1.25, -3.14);
    const driveTwo = drive.clone();
    const driveTwoGroup = new THREE.Group();
    driveTwoGroup.add(driveTwo);
    this.addGroup("storage-2", driveTwoGroup, 3.7, 1.38, -3.14);
    const driveGlow = this.box(0.36, 0.035, 0.02, 0xff0000, true);
    const driveGlowGroup = new THREE.Group();
    driveGlowGroup.add(driveGlow);
    this.addGroup("storage-3", driveGlowGroup, 3.7, 1.49, -2.99);
  }

  private buildRoomUpgrades(): void {
    const bedThrow = this.box(2.3, 0.07, 1.1, 0xb91c1c);
    this.addMeshGroup("bed-1", bedThrow, -4.15, 0.92, -1.65);
    const bedPillows = new THREE.Group();
    for (const x of [-0.58, 0.58]) {
      const pillow = this.box(0.95, 0.28, 0.62, 0xffffff);
      pillow.position.x = x;
      bedPillows.add(pillow);
    }
    this.addGroup("bed-2", bedPillows, -4.15, 0.96, -3.42);
    const bedLamp = new THREE.PointLight(0xffd2c2, 14, 3, 2);
    const bedLampGroup = new THREE.Group();
    bedLampGroup.add(bedLamp);
    this.addGroup("bed-3", bedLampGroup, -2.75, 1.25, -3.72);

    const chairHeadrest = this.box(0.7, 0.28, 0.18, 0xb91c1c);
    this.addMeshGroup("chair-1", chairHeadrest, 2.9, 1.83, -2.21);
    const chairArms = new THREE.Group();
    for (const x of [-0.5, 0.5]) {
      const arm = this.box(0.1, 0.55, 0.55, 0x202020);
      arm.position.x = x;
      chairArms.add(arm);
    }
    this.addGroup("chair-2", chairArms, 2.9, 1.05, -2.2);
    const chairAccent = this.box(0.65, 0.06, 0.08, 0xff0000, true);
    this.addMeshGroup("chair-3", chairAccent, 2.9, 1.42, -2.08);

    const deskShelf = this.box(2.7, 0.12, 0.42, 0x4b2c25);
    this.addMeshGroup("desk-1", deskShelf, 2.9, 0.72, -3.92);
    const deskSide = this.box(0.58, 1.05, 1.05, 0x2a2a2a);
    this.addMeshGroup("desk-2", deskSide, 4.55, 0.52, -3.55);
    const deskTopAccent = this.box(3.5, 0.045, 0.08, 0xff0000, true);
    this.addMeshGroup("desk-3", deskTopAccent, 2.9, 1.2, -2.94);

    const ringLight = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 10, 36),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe3d9, emissiveIntensity: 2 })
    );
    const ringGroup = new THREE.Group();
    ringLight.rotation.y = Math.PI / 2;
    ringGroup.add(ringLight);
    this.addGroup("lighting-1", ringGroup, 1.05, 2.0, -3.32);

    const softboxes = new THREE.Group();
    for (const x of [-1.25, 1.25]) {
      const panel = this.box(0.7, 0.9, 0.08, 0xffffff, true);
      panel.position.x = x;
      softboxes.add(panel);
    }
    this.addGroup("lighting-2", softboxes, 2.9, 2.05, -3.9);
    const studioGlow = new THREE.PointLight(0xfff2e8, 28, 5, 2);
    const studioGlowGroup = new THREE.Group();
    studioGlowGroup.add(studioGlow);
    this.addGroup("lighting-3", studioGlowGroup, 2.9, 2.6, -2.8);

    for (let level = 1; level <= 3; level += 1) {
      const acoustic = new THREE.Group();
      const count = level * 3;
      for (let index = 0; index < count; index += 1) {
        const panel = this.box(0.42, 0.72, 0.08, index % 2 === 0 ? 0x1a1a1a : 0x8b0000);
        panel.position.set((index - (count - 1) / 2) * 0.48, (index % 2) * 0.13, 0);
        acoustic.add(panel);
      }
      this.addGroup(`acoustic-${level}`, acoustic, 2.8, 2.55, -4.34);
    }

    const poster = this.box(1.05, 1.35, 0.045, 0xffffff);
    const posterRed = this.box(0.72, 0.28, 0.02, 0xff0000, true);
    posterRed.position.z = 0.035;
    const posterGroup = new THREE.Group();
    posterGroup.add(poster, posterRed);
    this.addGroup("decor-1", posterGroup, -2.1, 2.25, -4.34);

    const trophyShelf = new THREE.Group();
    const shelf = this.box(1.7, 0.12, 0.42, 0x4b2c25);
    trophyShelf.add(shelf);
    for (const x of [-0.55, 0, 0.55]) {
      const figure = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.16, 0.42, 12),
        new THREE.MeshStandardMaterial({ color: x === 0 ? 0xff0000 : 0xffffff, metalness: 0.2 })
      );
      figure.position.set(x, 0.27, 0);
      trophyShelf.add(figure);
    }
    this.addGroup("decor-2", trophyShelf, -1.9, 1.55, -4.2);

    const neon = new THREE.Group();
    const play = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.12, 3),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.2 })
    );
    play.rotation.z = -Math.PI / 2;
    play.rotation.x = Math.PI / 2;
    neon.add(play);
    this.addGroup("decor-3", neon, -1.85, 2.72, -4.25);
  }

  private addGroup(id: string, group: THREE.Group, x: number, y: number, z: number): void {
    group.position.set(x, y, z);
    group.visible = false;
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.scene.add(group);
    this.groups.set(id, group);
  }

  private addMeshGroup(id: string, mesh: THREE.Mesh, x: number, y: number, z: number): void {
    const group = new THREE.Group();
    group.add(mesh);
    this.addGroup(id, group, x, y, z);
  }

  private makeCaseBadge(color: number, radius: number): THREE.Group {
    const group = new THREE.Group();
    const badge = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.025, 8, 20),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 })
    );
    badge.rotation.x = Math.PI / 2;
    group.add(badge);
    return group;
  }

  private makeFanPanel(count: number, color: number): THREE.Group {
    const group = new THREE.Group();
    for (let index = 0; index < count; index += 1) {
      const fan = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.022, 8, 20),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65 })
      );
      fan.position.x = (index - (count - 1) / 2) * 0.2;
      group.add(fan);
    }
    return group;
  }

  private box(width: number, height: number, depth: number, color: number, emissive = false): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color,
        roughness: emissive ? 0.35 : 0.75,
        emissive: emissive ? color : 0x000000,
        emissiveIntensity: emissive ? 0.7 : 0
      })
    );
  }
}

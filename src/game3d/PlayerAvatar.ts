import * as THREE from "three";

type ActivityPose =
  | "none"
  | "computer"
  | "reading"
  | "studying"
  | "sleeping"
  | "eating"
  | "drinking";

export class PlayerAvatar {
  public readonly group = new THREE.Group();

  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly readingBook = new THREE.Group();
  private readonly mealBowl = new THREE.Group();
  private readonly waterCup = new THREE.Group();
  private readonly shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.72
  });
  private activity: ActivityPose = "none";
  private scriptedWalking = false;

  public constructor() {
    this.group.name = "player";
    this.group.position.set(0.6, 0, 1.8);
    this.buildCharacter();
    this.buildReadingBook();
    this.buildMealBowl();
    this.buildWaterCup();
  }

  public setPosition(x: number, z: number): void {
    this.group.position.x = x;
    this.group.position.z = z;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public async walkTo(
    x: number,
    z: number,
    durationMs = 900
  ): Promise<void> {
    const startX = this.group.position.x;
    const startZ = this.group.position.z;
    const direction = new THREE.Vector3(x - startX, 0, z - startZ);

    if (direction.lengthSq() < 0.0025) {
      this.setPosition(x, z);
      return;
    }

    this.clearActivityPose();
    this.setFacing(direction);
    this.scriptedWalking = true;

    await new Promise<void>((resolve) => {
      const startedAt = performance.now();
      const update = (now: number): void => {
        const linearProgress = Math.min(1, (now - startedAt) / durationMs);
        const progress =
          linearProgress * linearProgress * (3 - 2 * linearProgress);
        this.group.position.x = THREE.MathUtils.lerp(startX, x, progress);
        this.group.position.z = THREE.MathUtils.lerp(startZ, z, progress);

        if (linearProgress < 1) requestAnimationFrame(update);
        else resolve();
      };
      requestAnimationFrame(update);
    });

    this.scriptedWalking = false;
    this.group.position.x = x;
    this.group.position.z = z;
    this.updateWalkAnimation(performance.now() / 1000, false);
  }

  public setFacing(direction: THREE.Vector3): void {
    if (direction.lengthSq() < 0.0001) return;

    // O rosto do modelo aponta para -Z.
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
  }

  public updateWalkAnimation(time: number, moving: boolean): void {
    if (this.activity !== "none") {
      this.updateActivityAnimation(time);
      return;
    }

    const walking = moving || this.scriptedWalking;
    const swing = walking ? Math.sin(time * 10) * 0.55 : 0;
    const bounce = walking ? Math.abs(Math.sin(time * 10)) * 0.045 : 0;

    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    this.group.position.y = bounce;
  }

  public setComputerWorkPose(active: boolean): void {
    if (!active) {
      this.clearActivityPose();
      return;
    }

    this.prepareActivity("computer");
    this.group.rotation.y = 0;
    this.group.position.y = 0.48;
    this.leftLeg.rotation.x = -1.42;
    this.rightLeg.rotation.x = -1.42;
    this.leftArm.rotation.x = 1.05;
    this.rightArm.rotation.x = 1.05;
  }

  public setReadingPose(active: boolean): void {
    if (!active) {
      this.clearActivityPose();
      return;
    }

    this.prepareActivity("reading");
    this.readingBook.visible = true;
    this.group.rotation.y = 0;
    this.leftArm.rotation.x = 0.92;
    this.rightArm.rotation.x = 0.92;
    this.leftArm.rotation.z = -0.18;
    this.rightArm.rotation.z = 0.18;
  }

  public setStudyPose(active: boolean): void {
    if (!active) {
      this.clearActivityPose();
      return;
    }

    this.prepareActivity("studying");
    this.readingBook.visible = true;
    this.group.rotation.y = 0;
    this.group.position.y = 0.48;
    this.leftLeg.rotation.x = -1.42;
    this.rightLeg.rotation.x = -1.42;
    this.leftArm.rotation.x = 1.03;
    this.rightArm.rotation.x = 0.88;
    this.leftArm.rotation.z = -0.12;
    this.rightArm.rotation.z = 0.12;
    this.readingBook.position.set(0, 1.18, -0.52);
    this.readingBook.rotation.x = -0.35;
  }

  public setSleepingPose(active: boolean): void {
    if (!active) {
      this.clearActivityPose();
      return;
    }

    this.prepareActivity("sleeping");
    this.group.rotation.set(-Math.PI / 2, Math.PI, 0);
    this.group.position.y = 0.98;
    this.leftArm.rotation.x = 0.2;
    this.rightArm.rotation.x = -0.2;
    this.leftLeg.rotation.x = 0.08;
    this.rightLeg.rotation.x = -0.08;
  }

  public setMealPose(type: "meal" | "water" | null): void {
    if (!type) {
      this.clearActivityPose();
      return;
    }

    this.prepareActivity(type === "meal" ? "eating" : "drinking");
    this.group.rotation.y = -Math.PI / 2;
    this.leftArm.rotation.x = type === "meal" ? 0.9 : 0.65;
    this.rightArm.rotation.x = type === "meal" ? 1.12 : 1.25;
    this.leftArm.rotation.z = -0.14;
    this.rightArm.rotation.z = 0.12;
    this.mealBowl.visible = type === "meal";
    this.waterCup.visible = type === "water";
  }

  public updateComputerWorkAnimation(time: number): void {
    if (this.activity !== "computer") return;
    this.updateActivityAnimation(time);
  }

  public updateReadingAnimation(time: number): void {
    if (this.activity !== "reading") return;
    this.updateActivityAnimation(time);
  }

  public updateStudyAnimation(time: number): void {
    if (this.activity !== "studying") return;
    this.updateActivityAnimation(time);
  }

  public updateSleepAnimation(time: number): void {
    if (this.activity !== "sleeping") return;
    this.updateActivityAnimation(time);
  }

  public updateMealAnimation(time: number): void {
    if (this.activity !== "eating" && this.activity !== "drinking") return;
    this.updateActivityAnimation(time);
  }

  public cycleOutfit(): void {
    const colors = [0xf5f5f5, 0xff0000, 0x181818, 0xd1d5db, 0x991b1b];
    const current = this.shirtMaterial.color.getHex();
    const nextIndex = (colors.indexOf(current) + 1) % colors.length;
    this.shirtMaterial.color.setHex(colors[nextIndex]);
  }

  private prepareActivity(activity: ActivityPose): void {
    this.scriptedWalking = false;
    this.activity = activity;
    this.resetPose(false);
    this.readingBook.visible = false;
    this.mealBowl.visible = false;
    this.waterCup.visible = false;
  }

  private clearActivityPose(): void {
    this.activity = "none";
    this.scriptedWalking = false;
    this.readingBook.visible = false;
    this.mealBowl.visible = false;
    this.waterCup.visible = false;
    this.readingBook.position.set(0, 1.25, -0.48);
    this.readingBook.rotation.set(-0.48, 0, 0);
    this.resetPose(true);
  }

  private updateActivityAnimation(time: number): void {
    if (this.activity === "computer") {
      const typing = Math.sin(time * 13) * 0.09;
      const alternateTyping = Math.sin(time * 13 + Math.PI) * 0.09;
      const bodyMovement = Math.sin(time * 2.2) * 0.012;
      this.leftArm.rotation.x = 1.06 + typing;
      this.rightArm.rotation.x = 1.06 + alternateTyping;
      this.leftLeg.rotation.x = -1.42;
      this.rightLeg.rotation.x = -1.42;
      this.group.position.y = 0.48 + bodyMovement;
      return;
    }

    if (this.activity === "reading") {
      const breath = Math.sin(time * 2.1) * 0.012;
      const pageMotion = Math.sin(time * 1.1) * 0.025;
      this.group.position.y = breath;
      this.leftArm.rotation.x = 0.92 + pageMotion;
      this.rightArm.rotation.x = 0.92 - pageMotion;
      this.readingBook.rotation.z = Math.sin(time * 0.8) * 0.015;
      return;
    }

    if (this.activity === "studying") {
      const writing = Math.sin(time * 8.5) * 0.08;
      const breath = Math.sin(time * 2) * 0.01;
      this.group.position.y = 0.48 + breath;
      this.leftArm.rotation.x = 1.03;
      this.rightArm.rotation.x = 0.9 + writing;
      this.rightArm.rotation.z = 0.12 + writing * 0.22;
      this.readingBook.rotation.z = Math.sin(time * 0.7) * 0.012;
      return;
    }

    if (this.activity === "sleeping") {
      const breathing = Math.sin(time * 1.35) * 0.018;
      this.group.position.y = 0.98 + breathing;
      this.leftArm.rotation.z = Math.sin(time * 0.9) * 0.025;
      this.rightArm.rotation.z = -Math.sin(time * 0.9) * 0.025;
      return;
    }

    if (this.activity === "eating") {
      const bite = (Math.sin(time * 4.2) + 1) * 0.5;
      this.rightArm.rotation.x = 0.85 + bite * 0.55;
      this.leftArm.rotation.x = 0.9 + Math.sin(time * 2) * 0.03;
      this.mealBowl.position.y = 1.05 + Math.sin(time * 2) * 0.012;
      return;
    }

    if (this.activity === "drinking") {
      const sip = (Math.sin(time * 3.2) + 1) * 0.5;
      this.rightArm.rotation.x = 0.85 + sip * 0.62;
      this.waterCup.rotation.x = -0.18 - sip * 0.42;
      this.group.rotation.z = Math.sin(time * 1.4) * 0.008;
    }
  }

  private resetPose(resetGroupRotation: boolean): void {
    this.group.position.y = 0;
    if (resetGroupRotation) {
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
    }
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
  }

  private buildCharacter(): void {
    const skin = new THREE.MeshStandardMaterial({
      color: 0xd6a27d,
      roughness: 0.78
    });
    const hair = new THREE.MeshStandardMaterial({
      color: 0x2b211d,
      roughness: 0.9
    });
    const pants = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.84
    });
    const shoes = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.65
    });

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.55, 6, 12),
      this.shirtMaterial
    );
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 24, 16),
      skin
    );
    head.position.y = 1.82;
    head.castShadow = true;
    this.group.add(head);

    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.318, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      hair
    );
    hairCap.position.y = 1.9;
    hairCap.castShadow = true;
    this.group.add(hairCap);

    const faceDirection = -0.29;
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

    for (const eyeX of [-0.105, 0.105]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 10, 8),
        eyeMaterial
      );
      eye.position.set(eyeX, 1.85, faceDirection);
      this.group.add(eye);
    }

    this.leftArm.position.set(-0.42, 1.38, 0);
    this.rightArm.position.set(0.42, 1.38, 0);
    this.leftLeg.position.set(-0.17, 0.82, 0);
    this.rightLeg.position.set(0.17, 0.82, 0);

    this.leftArm.add(this.createLimb(0.12, 0.66, skin, -0.31));
    this.rightArm.add(this.createLimb(0.12, 0.66, skin, -0.31));
    this.leftLeg.add(this.createLimb(0.15, 0.75, pants, -0.36));
    this.rightLeg.add(this.createLimb(0.15, 0.75, pants, -0.36));

    const leftShoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.42),
      shoes
    );
    leftShoe.position.set(-0.17, 0.09, -0.08);
    leftShoe.castShadow = true;

    const rightShoe = leftShoe.clone();
    rightShoe.position.x = 0.17;

    this.group.add(
      this.leftArm,
      this.rightArm,
      this.leftLeg,
      this.rightLeg,
      leftShoe,
      rightShoe
    );
  }

  private buildReadingBook(): void {
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.78
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      roughness: 0.92
    });

    const leftCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.035, 0.54),
      coverMaterial
    );
    leftCover.position.x = -0.21;
    leftCover.rotation.z = 0.18;

    const rightCover = leftCover.clone();
    rightCover.position.x = 0.21;
    rightCover.rotation.z = -0.18;

    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.025, 0.48),
      pageMaterial
    );
    pages.position.y = 0.035;

    this.readingBook.add(leftCover, rightCover, pages);
    this.readingBook.position.set(0, 1.25, -0.48);
    this.readingBook.rotation.x = -0.48;
    this.readingBook.visible = false;
    this.group.add(this.readingBook);
  }

  private buildMealBowl(): void {
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.14, 0.12, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        side: THREE.DoubleSide
      })
    );
    const food = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.025, 20),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.92 })
    );
    food.position.y = 0.065;
    this.mealBowl.add(bowl, food);
    this.mealBowl.position.set(-0.14, 1.05, -0.43);
    this.mealBowl.visible = false;
    this.group.add(this.mealBowl);
  }

  private buildWaterCup(): void {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.08, 0.28, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.78,
        roughness: 0.18
      })
    );
    this.waterCup.add(cup);
    this.waterCup.position.set(0.26, 1.2, -0.4);
    this.waterCup.visible = false;
    this.group.add(this.waterCup);
  }

  private createLimb(
    radius: number,
    height: number,
    material: THREE.Material,
    y: number
  ): THREE.Mesh {
    const limb = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, height, 5, 10),
      material
    );
    limb.position.y = y;
    limb.castShadow = true;
    return limb;
  }
}

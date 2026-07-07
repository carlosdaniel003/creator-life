import * as THREE from "three";

export class PlayerAvatar {
  public readonly group = new THREE.Group();

  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly readingBook = new THREE.Group();
  private readonly shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.72
  });
  private workingAtComputer = false;
  private reading = false;

  public constructor() {
    this.group.name = "player";
    this.group.position.set(0.6, 0, 1.8);
    this.buildCharacter();
    this.buildReadingBook();
  }

  public setPosition(x: number, z: number): void {
    this.group.position.x = x;
    this.group.position.z = z;
  }

  public setFacing(direction: THREE.Vector3): void {
    if (direction.lengthSq() < 0.0001) return;

    // O rosto do modelo aponta para -Z. O cálculo anterior usava +Z e
    // fazia o personagem andar visualmente de costas.
    this.group.rotation.y = Math.atan2(-direction.x, -direction.z);
  }

  public updateWalkAnimation(time: number, moving: boolean): void {
    if (this.workingAtComputer) {
      this.updateComputerWorkAnimation(time);
      return;
    }

    if (this.reading) {
      this.updateReadingAnimation(time);
      return;
    }

    const swing = moving ? Math.sin(time * 10) * 0.55 : 0;
    const bounce = moving ? Math.abs(Math.sin(time * 10)) * 0.045 : 0;

    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    this.group.position.y = bounce;
  }

  public setComputerWorkPose(active: boolean): void {
    this.workingAtComputer = active;
    if (active) this.reading = false;
    this.readingBook.visible = false;

    if (active) {
      this.group.rotation.y = 0;
      this.group.position.y = 0.48;
      this.leftLeg.rotation.x = -1.42;
      this.rightLeg.rotation.x = -1.42;
      this.leftArm.rotation.x = 1.05;
      this.rightArm.rotation.x = 1.05;
      return;
    }

    this.resetPose();
  }

  public setReadingPose(active: boolean): void {
    this.reading = active;
    if (active) this.workingAtComputer = false;
    this.readingBook.visible = active;

    if (active) {
      this.group.rotation.y = 0;
      this.group.position.y = 0;
      this.leftArm.rotation.x = 0.92;
      this.rightArm.rotation.x = 0.92;
      this.leftArm.rotation.z = -0.18;
      this.rightArm.rotation.z = 0.18;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      return;
    }

    this.resetPose();
  }

  public updateComputerWorkAnimation(time: number): void {
    if (!this.workingAtComputer) return;

    const typing = Math.sin(time * 13) * 0.09;
    const alternateTyping = Math.sin(time * 13 + Math.PI) * 0.09;
    const bodyMovement = Math.sin(time * 2.2) * 0.012;

    this.leftArm.rotation.x = 1.06 + typing;
    this.rightArm.rotation.x = 1.06 + alternateTyping;
    this.leftLeg.rotation.x = -1.42;
    this.rightLeg.rotation.x = -1.42;
    this.group.position.y = 0.48 + bodyMovement;
  }

  public updateReadingAnimation(time: number): void {
    if (!this.reading) return;

    const breath = Math.sin(time * 2.1) * 0.012;
    const pageMotion = Math.sin(time * 1.1) * 0.025;
    this.group.position.y = breath;
    this.leftArm.rotation.x = 0.92 + pageMotion;
    this.rightArm.rotation.x = 0.92 - pageMotion;
    this.readingBook.rotation.z = Math.sin(time * 0.8) * 0.015;
  }

  public cycleOutfit(): void {
    const colors = [0xf5f5f5, 0xff0000, 0x181818, 0xd1d5db, 0x991b1b];
    const current = this.shirtMaterial.color.getHex();
    const nextIndex = (colors.indexOf(current) + 1) % colors.length;
    this.shirtMaterial.color.setHex(colors[nextIndex]);
  }

  private resetPose(): void {
    this.group.position.y = 0;
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

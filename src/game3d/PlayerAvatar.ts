import * as THREE from "three";

export class PlayerAvatar {
  public readonly group = new THREE.Group();

  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.72
  });

  public constructor() {
    this.group.name = "player";
    this.group.position.set(0.6, 0, 1.8);
    this.buildCharacter();
  }

  public setPosition(x: number, z: number): void {
    this.group.position.x = x;
    this.group.position.z = z;
  }

  public setFacing(direction: THREE.Vector3): void {
    if (direction.lengthSq() < 0.0001) {
      return;
    }

    this.group.rotation.y = Math.atan2(direction.x, direction.z);
  }

  public updateWalkAnimation(time: number, moving: boolean): void {
    const swing = moving ? Math.sin(time * 10) * 0.55 : 0;
    const bounce = moving ? Math.abs(Math.sin(time * 10)) * 0.045 : 0;

    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    this.group.position.y = bounce;
  }

  public cycleOutfit(): void {
    const colors = [0x38bdf8, 0x22c55e, 0x8b5cf6, 0xf97316, 0xec4899];
    const current = this.shirtMaterial.color.getHex();
    const nextIndex = (colors.indexOf(current) + 1) % colors.length;
    this.shirtMaterial.color.setHex(colors[nextIndex]);
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

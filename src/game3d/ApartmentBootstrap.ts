import * as THREE from "three";

import { ApartmentSurroundings } from "./ApartmentSurroundings";
import { CreatorLife3D } from "./CreatorLife3D";

type CreatorLifeInternals = {
  scene: THREE.Scene;
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  player: { group: THREE.Group };
  __apartmentSurroundingsInstalled?: boolean;
};

type CreatorLifePrototype = {
  configureLights: () => void;
  resize: () => void;
  updateCamera: (immediate: boolean) => void;
  __apartmentBootstrapPatched?: boolean;
};

const prototype = CreatorLife3D.prototype as unknown as CreatorLifePrototype;

if (!prototype.__apartmentBootstrapPatched) {
  prototype.__apartmentBootstrapPatched = true;

  const originalConfigureLights = prototype.configureLights;

  prototype.configureLights = function patchedConfigureLights(
    this: CreatorLifeInternals
  ): void {
    originalConfigureLights.call(this);

    if (!this.__apartmentSurroundingsInstalled) {
      this.__apartmentSurroundingsInstalled = true;
      new ApartmentSurroundings(this.scene);
    }
  };

  prototype.resize = function expandedApartmentResize(
    this: CreatorLifeInternals
  ): void {
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 320);
    const aspect = width / height;
    const frustumHeight = width < 760 ? 13.4 : width < 1180 ? 14.7 : 15.8;

    this.camera.left = (-frustumHeight * aspect) / 2;
    this.camera.right = (frustumHeight * aspect) / 2;
    this.camera.top = frustumHeight / 2;
    this.camera.bottom = -frustumHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  prototype.updateCamera = function expandedApartmentCamera(
    this: CreatorLifeInternals,
    immediate: boolean
  ): void {
    const playerPosition = this.player.group.position;
    const target = playerPosition.clone();
    target.x += 1.25;
    target.y = 0.72;
    target.z += 1.45;

    const desiredPosition = target
      .clone()
      .add(new THREE.Vector3(12.4, 13.7, 12.4));

    if (immediate) {
      this.camera.position.copy(desiredPosition);
    } else {
      this.camera.position.lerp(desiredPosition, 0.075);
    }

    this.camera.lookAt(target);
  };
}

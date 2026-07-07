import * as THREE from "three";

/** Correções visuais aplicadas depois que o quarto e os upgrades são montados. */
export function applySceneCorrections(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!(object.geometry instanceof THREE.BoxGeometry)) return;

    const { width, height, depth } = object.geometry.parameters;
    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;
    const color =
      material instanceof THREE.MeshStandardMaterial
        ? material.color.getHex()
        : null;

    // Encosto da cadeira base: o grupo vinha rotacionado em 180 graus.
    if (
      Math.abs(width - 0.85) < 0.01 &&
      Math.abs(height - 1.15) < 0.01 &&
      Math.abs(depth - 0.18) < 0.01 &&
      color === 0x334155 &&
      object.parent
    ) {
      object.parent.rotation.y = 0;
    }
  });
}

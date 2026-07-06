import type * as THREE from "three";

export interface PlayerState {
  day: number;
  hour: number;
  energy: number;
  hunger: number;
  creativity: number;
  money: number;
  subscribers: number;
  totalViews: number;
  videos: number;
}

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface InteractableDefinition {
  id: string;
  label: string;
  prompt: string;
  position: THREE.Vector3;
  root: THREE.Object3D;
  maxDistance: number;
}

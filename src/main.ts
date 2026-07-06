import Phaser from "phaser";

import { GameScene } from "./scenes/GameScene";

import "./styles.css";

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  parent: "game-container",

  width: 1280,
  height: 720,

  backgroundColor: "#101827",

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  scene: [
    GameScene
  ]
};

new Phaser.Game(gameConfig);
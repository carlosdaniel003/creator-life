import { CreatorLife3D } from "./game3d/CreatorLife3D";
import "./styles.css";

const container = document.getElementById("game-container");

if (!container) {
  throw new Error("O contêiner principal do jogo não foi encontrado.");
}

new CreatorLife3D(container);

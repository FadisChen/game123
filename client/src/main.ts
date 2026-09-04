import "./style.css";
import { GameController } from "./game/GameController";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app container not found");
}

new GameController(app);

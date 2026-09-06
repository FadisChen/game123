import "./style.css";
import "./game/game-ui.css";
import { HostController } from "./host/HostController";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app container not found");
}

document.body.classList.add("host-page");
new HostController(app);

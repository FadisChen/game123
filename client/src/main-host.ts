import "./style.css";
import { HostController } from "./host/HostController";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app container not found");
}

new HostController(app);

import "./style.css";
import "./game/game-ui.css";
import { JoinScreen } from "./ui/JoinScreen";
import { getPersistentPlayerId, SocketClient } from "./net/SocketClient";
import { NetworkedGameController } from "./game/NetworkedGameController";
import type { JoinErrorCode } from "shared";
import { installLandscapeGuard, requestLandscape } from "./ui/LandscapeGuard";

function joinErrorMessage(error: JoinErrorCode): string {
  switch (error) {
    case "ROOM_NOT_FOUND":
      return "找不到這個房間，請確認房號是否正確";
    case "NAME_TAKEN":
      return "這個名字已經有人使用了，換一個試試";
    case "NAME_INVALID":
      return "名字請輸入 1～10 個字";
    case "GAME_ALREADY_STARTED":
      return "遊戲已經開始，無法再加入";
    case "ROOM_FULL":
      return "房間人數已滿";
  }
}

function parseRoomCodeFromLocation(): string {
  const joinMatch = /\/join\/([^/?#]+)/.exec(location.pathname);
  if (joinMatch) return decodeURIComponent(joinMatch[1]);
  const fromQuery = new URLSearchParams(location.search).get("room");
  return fromQuery ?? "";
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app container not found");
}

installLandscapeGuard(app);

if (new URLSearchParams(location.search).has("offline")) {
  // 開發用旗標：跳過連線，直接跑 Phase 1 的本機版（純調美術/音效時不需要開伺服器）。
  void import("./game/GameController").then(({ GameController }) => {
    new GameController(app);
  });
} else {
  const initialRoomCode = parseRoomCodeFromLocation();
  const playerId = getPersistentPlayerId();

  const joinScreen = new JoinScreen(app, initialRoomCode, (roomCode, name) => {
    void requestLandscape();
    joinScreen.setBusy(true);
    const socketClient = new SocketClient();
    void socketClient
      .joinRoom({ roomCode, playerId, name })
      .then((ack) => {
        if (!ack.ok) {
          joinScreen.setBusy(false);
          joinScreen.showError(joinErrorMessage(ack.error));
          socketClient.disconnect();
          return;
        }
        joinScreen.remove();
        new NetworkedGameController(app, socketClient, roomCode, playerId, name, ack.snapshot);
      })
      .catch(() => {
        joinScreen.setBusy(false);
        joinScreen.showError("連線失敗，請稍後再試");
        socketClient.disconnect();
      });
  });
}

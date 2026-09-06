import "./style.css";
import "./game/game-ui.css";
import { JoinScreen } from "./ui/JoinScreen";
import {
  clearPlayerSession,
  getStoredPlayerSession,
  SocketClient,
} from "./net/SocketClient";
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
    case "RATE_LIMITED":
      return "操作太頻繁，請稍後再試";
    case "SESSION_INVALID":
      return "遊戲服務已重新啟動，請重新掃描 QR Code";
    case "INVALID_PAYLOAD":
      return "加入資料無效，請重新操作";
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

  const joinScreen = new JoinScreen(app, initialRoomCode, (roomCode, name) => {
    void requestLandscape();
    joinScreen.setBusy(true);
    const socketClient = new SocketClient();
    void socketClient
      .joinRoom({ roomCode, name })
      .then((ack) => {
        if (!ack.ok) {
          joinScreen.setBusy(false);
          joinScreen.showError(joinErrorMessage(ack.error));
          socketClient.disconnect();
          return;
        }
        socketClient.setPlayerSession({
          roomCode,
          playerId: ack.playerId,
          sessionToken: ack.playerSessionToken,
          name,
          nextClientSeq: 0,
        });
        joinScreen.remove();
        new NetworkedGameController(app, socketClient, roomCode, ack.playerId, name, ack.snapshot);
      })
      .catch(() => {
        joinScreen.setBusy(false);
        joinScreen.showError("連線失敗，請稍後再試");
        socketClient.disconnect();
      });
  });

  const storedSession = getStoredPlayerSession(initialRoomCode || undefined);
  if (storedSession && initialRoomCode) {
    const socketClient = new SocketClient();
    socketClient.setPlayerSession(storedSession);
    joinScreen.setBusy(true);
    void socketClient
      .resumePlayerRoom()
      .then((ack) => {
        if (!ack.ok) {
          clearPlayerSession();
          joinScreen.setBusy(false);
          joinScreen.showError("遊戲服務已重新啟動，請重新掃描 QR Code");
          socketClient.disconnect();
          return;
        }
        socketClient.setPlayerSession({ ...storedSession, sessionToken: ack.playerSessionToken });
        joinScreen.remove();
        new NetworkedGameController(
          app,
          socketClient,
          ack.snapshot.roomCode,
          ack.playerId,
          storedSession.name,
          ack.snapshot,
        );
      })
      .catch(() => {
        joinScreen.setBusy(false);
        joinScreen.showError("連線失敗，請稍後再試");
        socketClient.disconnect();
      });
  }
}

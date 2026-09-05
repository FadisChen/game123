import QRCode from "qrcode";
import type { GhostState, PlayerSummary, RankedPlayer, RoomPhase } from "shared";
import type { HostCameraMode } from "./HostScene";

export interface HostConsolePanelCallbacks {
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onRestart: () => void;
  onCameraModeChange: (mode: HostCameraMode) => void;
}

const CAMERA_MODE_OPTIONS: { mode: HostCameraMode; label: string }[] = [
  { mode: "birdseye", label: "鳥瞰" },
  { mode: "leader", label: "領先者" },
  { mode: "last", label: "落後者" },
  { mode: "free", label: "自由鏡頭" },
];

const PHASE_LABEL: Record<RoomPhase, string> = {
  WAITING: "等待中",
  COUNTDOWN: "倒數中",
  PLAYING: "進行中",
  PAUSED: "已暫停",
  GAME_OVER: "已結束",
};

/** 主辦方主控台側邊欄（對應 PRD 第 12 章）：房號/QR、玩家清單、鬼的狀態、控制按鈕、排名彈窗。 */
export class HostConsolePanel {
  private readonly root: HTMLDivElement;
  private readonly qrWrapper: HTMLDivElement;
  private readonly qrImg: HTMLImageElement;
  private readonly phaseEl: HTMLDivElement;
  private readonly ghostStatusEl: HTMLDivElement;
  private readonly playerListEl: HTMLDivElement;
  private readonly rankingOverlay: HTMLDivElement;
  private readonly rankingListEl: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly endButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly toggleQrButton: HTMLButtonElement;
  private readonly cameraModeButtons = new Map<HostCameraMode, HTMLButtonElement>();

  constructor(container: HTMLElement, roomCode: string, joinUrl: string, callbacks: HostConsolePanelCallbacks) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position:absolute; top:0; right:0; bottom:0; width:300px; max-width:80vw;
      background:#222222ee; color:#f2f2f2; padding:16px; overflow-y:auto; box-sizing:border-box;
      display:flex; flex-direction:column; gap:12px; font-size:14px; pointer-events:auto;
    `;

    const header = document.createElement("div");
    header.textContent = "123 木頭人";
    header.style.cssText = "font-size:20px; font-weight:800;";
    this.root.appendChild(header);

    const roomCodeEl = document.createElement("div");
    roomCodeEl.textContent = roomCode;
    roomCodeEl.style.cssText = `
      font-size:28px; font-weight:900; letter-spacing:4px; text-align:center;
      background:#333333; border-radius:12px; padding:8px;
    `;
    this.root.appendChild(roomCodeEl);

    this.qrWrapper = document.createElement("div");
    this.qrWrapper.style.cssText = "display:flex; justify-content:center; background:#fff; border-radius:12px; padding:8px;";
    this.qrImg = document.createElement("img");
    this.qrImg.style.cssText = "width:160px; height:160px;";
    this.qrWrapper.appendChild(this.qrImg);
    this.root.appendChild(this.qrWrapper);
    void QRCode.toDataURL(joinUrl, { width: 320, margin: 1 }).then((url) => {
      this.qrImg.src = url;
    });

    this.phaseEl = document.createElement("div");
    this.phaseEl.style.cssText = "font-weight:700;";
    this.root.appendChild(this.phaseEl);

    this.ghostStatusEl = document.createElement("div");
    this.ghostStatusEl.style.cssText = "padding:6px 10px; border-radius:8px; background:#333333;";
    this.root.appendChild(this.ghostStatusEl);

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display:flex; flex-wrap:wrap; gap:8px;";
    this.startButton = this.buildButton(buttonRow, "開始遊戲", "#118a65", callbacks.onStart);
    this.pauseButton = this.buildButton(buttonRow, "暫停遊戲", "#f4a261", callbacks.onPause);
    this.resumeButton = this.buildButton(buttonRow, "繼續遊戲", "#118a65", callbacks.onResume);
    this.endButton = this.buildButton(buttonRow, "結束遊戲", "#f94144", callbacks.onEnd);
    this.restartButton = this.buildButton(buttonRow, "重新開始", "#2f80ed", callbacks.onRestart);
    this.toggleQrButton = this.buildButton(buttonRow, "隱藏 QR", "#333333", () => this.toggleQr());
    this.buildButton(buttonRow, "顯示排名", "#8a4fd6", () => this.toggleRankingVisibility());
    this.root.appendChild(buttonRow);

    const cameraTitle = document.createElement("div");
    cameraTitle.textContent = "鏡頭模式";
    cameraTitle.style.cssText = "font-weight:700; margin-top:4px;";
    this.root.appendChild(cameraTitle);

    const cameraRow = document.createElement("div");
    cameraRow.style.cssText = "display:flex; flex-wrap:wrap; gap:8px;";
    for (const { mode, label } of CAMERA_MODE_OPTIONS) {
      const button = this.buildButton(cameraRow, label, "#333333", () => {
        callbacks.onCameraModeChange(mode);
        this.setActiveCameraMode(mode);
      });
      this.cameraModeButtons.set(mode, button);
    }
    this.root.appendChild(cameraRow);
    this.setActiveCameraMode("birdseye");

    const listTitle = document.createElement("div");
    listTitle.textContent = "玩家";
    listTitle.style.cssText = "font-weight:700; margin-top:4px;";
    this.root.appendChild(listTitle);

    this.playerListEl = document.createElement("div");
    this.playerListEl.style.cssText = "display:flex; flex-direction:column; gap:4px;";
    this.root.appendChild(this.playerListEl);

    this.rankingOverlay = document.createElement("div");
    this.rankingOverlay.style.cssText = `
      position:absolute; inset:0; background:#000000cc; display:none;
      align-items:center; justify-content:center; z-index:15; pointer-events:auto;
    `;
    const rankingCard = document.createElement("div");
    rankingCard.style.cssText = `
      background:#333333; border-radius:20px; padding:24px 32px;
      max-width:min(420px, 86vw); max-height:80vh; overflow-y:auto;
    `;
    const rankingTitle = document.createElement("h2");
    rankingTitle.textContent = "排名結果";
    rankingTitle.style.cssText = "margin:0 0 16px; text-align:center; color:#f2f2f2;";
    rankingCard.appendChild(rankingTitle);
    this.rankingListEl = document.createElement("div");
    this.rankingListEl.style.cssText = "display:flex; flex-direction:column; gap:6px; min-width:240px;";
    rankingCard.appendChild(this.rankingListEl);
    this.rankingOverlay.appendChild(rankingCard);
    this.rankingOverlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.rankingOverlay) this.rankingOverlay.style.display = "none";
    });
    container.appendChild(this.rankingOverlay);

    container.appendChild(this.root);
    this.setPhase("WAITING");
  }

  private buildButton(row: HTMLElement, label: string, color: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = label;
    button.style.cssText = `
      border:none; border-radius:10px; background:${color}; color:#fff;
      font-size:13px; font-weight:700; padding:8px 12px; cursor:pointer; flex:1 1 auto;
    `;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      onClick();
    });
    row.appendChild(button);
    return button;
  }

  private setActiveCameraMode(mode: HostCameraMode): void {
    for (const [buttonMode, button] of this.cameraModeButtons) {
      button.style.background = buttonMode === mode ? "#8a4fd6" : "#333333";
    }
  }

  setPhase(phase: RoomPhase): void {
    this.phaseEl.textContent = `遊戲狀態：${PHASE_LABEL[phase]}`;
    this.startButton.disabled = phase !== "WAITING";
    this.pauseButton.disabled = phase !== "PLAYING";
    this.resumeButton.disabled = phase !== "PAUSED";
    this.endButton.disabled = phase === "WAITING" || phase === "GAME_OVER";
    this.restartButton.disabled = phase !== "GAME_OVER";
  }

  setCountdown(value: number | "GO"): void {
    this.phaseEl.textContent = `遊戲狀態：${PHASE_LABEL.COUNTDOWN}（${value}）`;
  }

  setGhostState(state: GhostState, isLooking: boolean): void {
    this.ghostStatusEl.textContent = isLooking ? "⚠️ 鬼回頭中！" : `鬼狀態：${state}`;
    this.ghostStatusEl.style.background = isLooking ? "#f94144" : "#333333";
  }

  setPlayers(players: PlayerSummary[]): void {
    this.playerListEl.innerHTML = "";
    for (const player of players) {
      const row = document.createElement("div");
      row.style.cssText = `
        display:flex; justify-content:space-between; padding:4px 8px; border-radius:8px;
        background:#2c2c2c; opacity:${player.connected ? 1 : 0.5};
      `;
      const status = player.finished ? "🏆" : player.eliminated ? "💀" : player.boosted ? "⚡" : "";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = `${player.name} ${status}`;
      const scoreSpan = document.createElement("span");
      scoreSpan.textContent = "❤️".repeat(Math.max(player.score, 0));
      row.appendChild(nameSpan);
      row.appendChild(scoreSpan);
      this.playerListEl.appendChild(row);
    }
  }

  showRanking(ranking: RankedPlayer[]): void {
    this.rankingListEl.innerHTML = "";
    for (const entry of ranking) {
      const outcomeIcon = entry.outcome === "finished" ? "🏆" : entry.outcome === "eliminated" ? "💀" : "⏱";
      const row = document.createElement("div");
      row.style.cssText = "display:flex; justify-content:space-between; gap:16px; color:#f2f2f2; padding:4px 0;";
      const label = document.createElement("span");
      label.textContent = `#${entry.rank} ${entry.name} ${outcomeIcon}`;
      const distance = document.createElement("span");
      distance.textContent = `${entry.distance.toFixed(1)}m`;
      row.appendChild(label);
      row.appendChild(distance);
      this.rankingListEl.appendChild(row);
    }
    this.rankingOverlay.style.display = "flex";
  }

  private toggleRankingVisibility(): void {
    const visible = this.rankingOverlay.style.display === "flex";
    this.rankingOverlay.style.display = visible ? "none" : "flex";
  }

  private toggleQr(): void {
    const hidden = this.qrWrapper.style.display === "none";
    this.qrWrapper.style.display = hidden ? "flex" : "none";
    this.toggleQrButton.textContent = hidden ? "隱藏 QR" : "顯示 QR";
  }
}

import QRCode from "qrcode";
import {
  DEFAULT_ROOM_SETTINGS,
  PLAYER_MODE_OPTIONS,
  SCORE_OPTIONS,
  type GhostState,
  type ConnectionState,
  type PlayerMode,
  type PlayerSummary,
  type RankedPlayer,
  type RoomPhase,
  type RoomSettings,
} from "shared";
import type { HostCameraMode } from "./HostScene";
import { playerLaneX, playerWorldZ } from "../game/PlayerAvatars";
import { GameStatus } from "../ui/SignalStatus";
import { FIELD_LENGTH } from "../game/fieldEnvironment";

export interface HostConsolePanelCallbacks {
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onRestart: () => void;
  onMusicRetry: () => void;
  onCameraModeChange: (mode: HostCameraMode) => void;
  onCameraDirection: (direction: string, pressed: boolean) => void;
  onSettingsChange: (settings: RoomSettings) => void;
}

const CAMERA_MODE_OPTIONS: { mode: HostCameraMode; label: string }[] = [
  { mode: "birdseye", label: "鳥瞰" },
  { mode: "leader", label: "領先者" },
  { mode: "last", label: "落後者" },
  { mode: "free", label: "自由鏡頭" },
];
const PHASE_LABEL: Record<RoomPhase, string> = {
  WAITING: "等待玩家加入",
  PLAYING: "遊戲進行中",
  PAUSED: "遊戲已暫停",
  GAME_OVER: "本局已結束",
};
const SVG_NS = "http://www.w3.org/2000/svg";

export class HostConsolePanel {
  private readonly root = document.createElement("aside");
  private readonly signal = new GameStatus();
  private readonly musicRetryButton = document.createElement("button");
  private readonly phaseEl = document.createElement("span");
  private readonly connectionEl = document.createElement("p");
  private readonly countEl = document.createElement("div");
  private readonly playerListEl = document.createElement("div");
  private readonly rankingOverlay = document.createElement("div");
  private readonly rankingListEl = document.createElement("div");
  private readonly countdownOverlay = document.createElement("div");
  private readonly countdownDigit = document.createElement("div");
  private readonly roomDetails = document.createElement("details");
  private readonly settingsSection: HTMLElement;
  private readonly cameraModeButtons = new Map<
    HostCameraMode,
    HTMLButtonElement
  >();
  private readonly actionButtons = new Map<string, HTMLButtonElement>();
  private readonly scoreButtons = new Map<number, HTMLButtonElement>();
  private readonly playerModeButtons = new Map<PlayerMode, HTMLButtonElement>();
  private readonly distanceInput = document.createElement("input");
  private readonly distanceEl = document.createElement("div");
  private settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
  private readonly mapPlayers = document.createElementNS(SVG_NS, "g");
  private readonly cameraCone = document.createElementNS(SVG_NS, "path");
  private readonly cameraDot = document.createElementNS(SVG_NS, "circle");
  private phase: RoomPhase = "WAITING";
  /** 開場運鏡＋倒數期間鎖住「開始遊戲」鈕，避免快照更新（例如有玩家加入）把它重新打開造成連點。 */
  private starting = false;
  /** setPlayers() 每次都重建整份名單，所以「剛出局／剛抵達」的高亮要記在這裡才能撐過重建。 */
  private readonly flashing = new Map<string, "eliminated" | "finished">();
  private lastPlayers: PlayerSummary[] = [];

  constructor(
    container: HTMLElement,
    roomCode: string,
    joinUrl: string,
    callbacks: HostConsolePanelCallbacks,
  ) {
    this.root.className = "host-panel";
    this.root.setAttribute("aria-label", "主辦方控制台");
    const brand = document.createElement("div");
    brand.className = "host-brand";
    brand.innerHTML = `<span class="brand-symbol" aria-hidden="true">○ △ □</span><div><strong>123 木頭人</strong><span>主辦方控制台 · 房間 ${roomCode}</span></div>`;
    container.appendChild(brand);

    const status = this.section("遊戲狀態");
    this.phaseEl.className = "phase-label";
    status.append(this.phaseEl, this.signal.root);
    this.connectionEl.className = "host-connection-status";
    this.connectionEl.hidden = true;
    status.appendChild(this.connectionEl);
    this.musicRetryButton.type = "button";
    this.musicRetryButton.className = "music-retry-button";
    this.musicRetryButton.textContent = "啟用音樂";
    this.musicRetryButton.hidden = true;
    this.musicRetryButton.addEventListener("click", callbacks.onMusicRetry);
    status.appendChild(this.musicRetryButton);
    this.countEl.className = "survivor-count";
    status.appendChild(this.countEl);
    this.distanceEl.className = "host-course-distance";
    status.appendChild(this.distanceEl);
    const actions = document.createElement("div");
    actions.className = "host-actions";
    for (const [key, label, action] of [
      ["start", "開始遊戲", callbacks.onStart],
      ["pause", "暫停遊戲", callbacks.onPause],
      ["resume", "繼續遊戲", callbacks.onResume],
      ["end", "結束遊戲", callbacks.onEnd],
      ["restart", "重新開始", callbacks.onRestart],
    ] as const) {
      const button = this.buildButton(actions, label, action);
      button.classList.add(key === "end" ? "danger-button" : "primary-button");
      this.actionButtons.set(key, button);
    }
    status.appendChild(actions);

    // 只在 WAITING 階段開放（見 setPhase）：開打後才換數值會讓已經扣過血的玩家跟判定基準不一致。
    const settings = this.section("遊戲設定");
    this.settingsSection = settings;
    settings.append(
      this.settingRow(
        "每人血量",
        SCORE_OPTIONS,
        this.scoreButtons,
        (value) => String(value),
        (maxScore) =>
          callbacks.onSettingsChange({ ...this.settings, maxScore }),
      ),
    );
    settings.append(
      this.settingRow(
        "玩家玩法",
        PLAYER_MODE_OPTIONS,
        this.playerModeButtons,
        (mode) => (mode === "main" ? "主視角" : "感應式"),
        (playerMode) =>
          callbacks.onSettingsChange({ ...this.settings, playerMode }),
      ),
    );
    const distanceLabel = document.createElement("label");
    distanceLabel.className = "setting-row distance-setting";
    distanceLabel.innerHTML = "<span>遊戲距離（m）</span>";
    this.distanceInput.type = "number";
    this.distanceInput.min = "0.1";
    this.distanceInput.step = "0.1";
    this.distanceInput.inputMode = "decimal";
    this.distanceInput.required = true;
    this.distanceInput.addEventListener("change", () => {
      if (
        !this.distanceInput.reportValidity() ||
        !Number.isFinite(this.distanceInput.valueAsNumber)
      ) {
        this.distanceInput.value = this.settings.finishDistanceM.toFixed(1);
        return;
      }
      callbacks.onSettingsChange({
        ...this.settings,
        finishDistanceM: this.distanceInput.valueAsNumber,
      });
    });
    distanceLabel.appendChild(this.distanceInput);
    settings.appendChild(distanceLabel);

    const camera = this.section("鏡頭控制");
    const modes = document.createElement("div");
    modes.className = "camera-modes";
    for (const { mode, label } of CAMERA_MODE_OPTIONS) {
      const button = this.buildButton(modes, label, () =>
        callbacks.onCameraModeChange(mode),
      );
      button.dataset.cameraMode = mode;
      this.cameraModeButtons.set(mode, button);
    }
    camera.appendChild(modes);
    const map = document.createElementNS(SVG_NS, "svg");
    map.classList.add("camera-map");
    map.setAttribute("viewBox", "0 0 240 144");
    map.setAttribute("role", "img");
    map.setAttribute("aria-label", "玩家位置與鏡頭方向小地圖");
    map.innerHTML = `<defs><linearGradient id="camera-beam" x2="0" y2="1"><stop stop-color="#eff8d9" stop-opacity=".04"/><stop offset="1" stop-color="#eff8d9" stop-opacity=".3"/></linearGradient></defs>
      <rect x="68" y="12" width="104" height="120" fill="#978351" fill-opacity=".45" stroke="#d7d9b0" stroke-opacity=".4"/>
      <path d="M68 28H172" stroke="#e895ae"/><path d="M68 113H172" stroke="#e9e3c5" stroke-opacity=".5"/>
      <circle cx="120" cy="17" r="4" fill="#eaaa50"/>`;
    this.cameraCone.setAttribute("fill", "url(#camera-beam)");
    this.cameraDot.setAttribute("r", "4");
    this.cameraDot.setAttribute("fill", "#f5f5e8");
    map.append(this.cameraCone, this.mapPlayers, this.cameraDot);
    camera.appendChild(map);
    const dpad = document.createElement("div");
    dpad.className = "camera-dpad";
    for (const [direction, arrow, label] of [
      ["ArrowUp", "↑", "鏡頭向前"],
      ["ArrowLeft", "←", "鏡頭向左"],
      ["ArrowDown", "↓", "鏡頭向後"],
      ["ArrowRight", "→", "鏡頭向右"],
    ]) {
      const button = this.buildButton(dpad, arrow, () => {});
      button.dataset.direction = direction;
      button.setAttribute("aria-label", label);
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        callbacks.onCameraDirection(direction, true);
      });
      const release = () => callbacks.onCameraDirection(direction, false);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      button.addEventListener("click", (event) => {
        if (event.detail !== 0) return;
        callbacks.onCameraDirection(direction, true);
        window.setTimeout(release, 160);
      });
    }

    this.roomDetails.className = "host-card room-details";
    this.roomDetails.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "邀請玩家";
    this.roomDetails.appendChild(summary);
    const code = document.createElement("div");
    code.className = "room-code";
    code.dataset.roomCode = roomCode;
    code.textContent = roomCode;
    const qr = document.createElement("img");
    qr.className = "room-qr";
    qr.alt = `掃描加入房間 ${roomCode}`;
    void QRCode.toDataURL(joinUrl, { width: 256, margin: 2 }).then((url) => {
      qr.src = url;
    });
    const link = document.createElement("a");
    link.href = joinUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "開啟玩家加入頁 ↗";
    this.roomDetails.append(code, qr, link);
    this.root.appendChild(this.roomDetails);

    const players = document.createElement("details");
    players.className = "host-card player-details";
    const playersTitle = document.createElement("summary");
    playersTitle.textContent = "玩家名單與排名";
    this.playerListEl.className = "host-player-list";
    players.append(playersTitle, this.playerListEl);
    this.buildButton(players, "顯示排名", () => {
      this.rankingOverlay.hidden = false;
    });
    this.root.appendChild(players);

    this.rankingOverlay.className = "screen-overlay ranking-overlay";
    this.rankingOverlay.setAttribute("role", "dialog");
    this.rankingOverlay.setAttribute("aria-label", "排名結果");
    this.rankingOverlay.hidden = true;
    const rankingCard = document.createElement("div");
    rankingCard.className = "screen-card";
    const rankingTitle = document.createElement("h2");
    rankingTitle.textContent = "排名結果";
    this.rankingListEl.className = "ranking-list";
    this.rankingListEl.textContent = "遊戲結束後，將在這裡顯示排名。";
    rankingCard.append(rankingTitle, this.rankingListEl);
    this.buildButton(rankingCard, "關閉排名", () => {
      this.rankingOverlay.hidden = true;
    });
    this.rankingOverlay.appendChild(rankingCard);
    this.rankingOverlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.rankingOverlay)
        this.rankingOverlay.hidden = true;
    });
    this.countdownOverlay.className = "countdown-overlay";
    this.countdownOverlay.setAttribute("role", "status");
    this.countdownOverlay.setAttribute("aria-live", "assertive");
    this.countdownOverlay.hidden = true;
    this.countdownDigit.className = "countdown-digit";
    this.countdownOverlay.appendChild(this.countdownDigit);

    container.append(this.root, this.rankingOverlay, this.countdownOverlay);
    this.setActiveCameraMode("birdseye");
    this.setSettings(this.settings);
    this.setPhase("WAITING");
  }

  private section(title: string): HTMLElement {
    const section = document.createElement("section");
    section.className = "host-card";
    const heading = document.createElement("h2");
    heading.textContent = title;
    section.appendChild(heading);
    this.root.appendChild(section);
    return section;
  }

  /** 一列「標題 + 一排互斥切換鈕」，選取狀態用 aria-pressed 表示（沿用鏡頭模式那排的樣式與語意）。 */
  private settingRow<T>(
    title: string,
    values: readonly T[],
    registry: Map<T, HTMLButtonElement>,
    labelOf: (value: T) => string,
    onPick: (value: T) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "setting-row";
    const heading = document.createElement("span");
    heading.textContent = title;
    const buttons = document.createElement("div");
    buttons.className = "camera-modes setting-options";
    for (const value of values) {
      registry.set(
        value,
        this.buildButton(buttons, labelOf(value), () => onPick(value)),
      );
    }
    row.append(heading, buttons);
    return row;
  }

  private buildButton(
    row: HTMLElement,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    row.appendChild(button);
    return button;
  }

  setActiveCameraMode(mode: HostCameraMode): void {
    for (const [buttonMode, button] of this.cameraModeButtons)
      button.setAttribute("aria-pressed", String(buttonMode === mode));
  }

  setSettings(settings: RoomSettings): void {
    this.settings = settings;
    this.distanceInput.value = settings.finishDistanceM.toFixed(1);
    this.distanceEl.textContent = `全程 ${settings.finishDistanceM.toFixed(1)} m`;
    for (const [value, button] of this.scoreButtons)
      button.setAttribute("aria-pressed", String(value === settings.maxScore));
    for (const [mode, button] of this.playerModeButtons)
      button.setAttribute("aria-pressed", String(mode === settings.playerMode));
  }

  /** 開場運鏡＋倒數期間呼叫 setStarting(true) 鎖住「開始遊戲」鈕；期間收到的快照更新（setPhase）不能把它重新打開。 */
  setStarting(starting: boolean): void {
    this.starting = starting;
    this.updateActionButtons();
  }

  private updateActionButtons(): void {
    const phase = this.phase;
    for (const [key, button] of this.actionButtons) {
      const enabled =
        key === "start"
          ? phase === "WAITING" && !this.starting
          : key === "pause"
            ? phase === "PLAYING"
            : key === "resume"
              ? phase === "PAUSED"
              : key === "restart"
                ? phase === "GAME_OVER"
                : phase !== "WAITING" && phase !== "GAME_OVER";
      button.disabled = !enabled;
      button.hidden = !enabled;
    }
  }

  /** 全螢幕紅色數字倒數（3→2→1，各顯示 1 秒），倒數完呼叫 onDone——由呼叫端接著真正送出 startGame。 */
  playCountdown(onDone: () => void): void {
    this.countdownOverlay.hidden = false;
    let remaining = 3;
    const showDigit = () => {
      this.countdownDigit.textContent = String(remaining);
      this.countdownDigit.classList.remove("countdown-digit-pulse");
      void this.countdownDigit.offsetWidth;
      this.countdownDigit.classList.add("countdown-digit-pulse");
    };
    showDigit();
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        this.countdownOverlay.hidden = true;
        onDone();
        return;
      }
      showDigit();
      window.setTimeout(tick, 1000);
    };
    window.setTimeout(tick, 1000);
  }

  setPhase(phase: RoomPhase): void {
    if (phase !== this.phase) this.roomDetails.open = phase === "WAITING";
    this.phase = phase;
    this.phaseEl.textContent = PHASE_LABEL[phase];
    this.updateActionButtons();
    // 開打後設定就鎖住了，整塊收起來把版面讓給鏡頭控制與玩家名單。
    this.settingsSection.hidden = phase !== "WAITING";
    this.distanceInput.disabled = phase !== "WAITING";
    for (const button of [
      ...this.scoreButtons.values(),
      ...this.playerModeButtons.values(),
    ]) {
      button.disabled = phase !== "WAITING";
    }
    if (phase === "WAITING") this.rankingOverlay.hidden = true;
  }

  showMusicPlaybackError(): void {
    this.musicRetryButton.textContent = "音樂播放失敗 · 點此重試";
    this.musicRetryButton.hidden = false;
  }

  clearMusicPlaybackError(): void {
    this.musicRetryButton.textContent = "啟用音樂";
    this.musicRetryButton.hidden = true;
  }

  setConnectionState(state: ConnectionState): void {
    this.connectionEl.hidden = state === "connected";
    this.connectionEl.textContent =
      state === "connecting"
        ? "正在連線…"
        : state === "reconnecting"
          ? "連線異常，正在重新連線…"
          : "連線已中斷，請稍候…";
  }

  showConnectionError(message: string): void {
    this.connectionEl.hidden = false;
    this.connectionEl.textContent = message;
  }

  setGhostState(state: GhostState): void {
    this.signal.update(state, this.phase);
  }

  setPlayers(players: PlayerSummary[]): void {
    this.lastPlayers = players;
    const alive = players.filter((player) => !player.eliminated).length;
    this.countEl.innerHTML = `<span>存活玩家</span><div><strong>${alive}</strong><span> / ${players.length}</span></div>`;
    this.playerListEl.replaceChildren();
    this.mapPlayers.replaceChildren();
    if (!players.length)
      this.playerListEl.textContent = "分享房號，邀請第一位玩家加入。";
    players.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "host-player-row";
      row.dataset.playerId = player.playerId;
      const flash = this.flashing.get(player.playerId);
      if (flash)
        row.classList.add(
          flash === "finished" ? "row-flash-win" : "row-flash-out",
        );
      const name = document.createElement("span");
      name.textContent = `${String(index + 1).padStart(3, "0")}  ${player.name}`;
      const status = document.createElement("span");
      status.textContent = player.finished
        ? "已抵達"
        : player.eliminated
          ? "已淘汰"
          : !player.connected
            ? "離線"
            : `${player.score} ♥`;
      row.append(name, status);
      this.playerListEl.appendChild(row);
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute(
        "cx",
        String(120 - playerLaneX(index, players.length) * 4),
      );
      dot.setAttribute(
        "cy",
        String(
          113 -
            (playerWorldZ(
              index,
              player.distance,
              this.settings.finishDistanceM,
            ) /
              FIELD_LENGTH) *
              85,
        ),
      );
      dot.setAttribute("r", "2.3");
      dot.setAttribute("fill", player.eliminated ? "#e7908c" : "#8eecb0");
      this.mapPlayers.appendChild(dot);
    });
  }

  /** 名單上高亮剛出局／剛抵達的那一列，讓主持人在幾十個人裡找得到是誰。 */
  flashPlayer(playerId: string, outcome: "eliminated" | "finished"): void {
    this.flashing.set(playerId, outcome);
    this.setPlayers(this.lastPlayers);
    window.setTimeout(() => {
      this.flashing.delete(playerId);
      this.setPlayers(this.lastPlayers);
    }, 2000);
  }

  setCameraView(
    position: { x: number; z: number },
    target: { x: number; z: number },
  ): void {
    const x = Math.max(8, Math.min(232, 120 - position.x * 4));
    const y = Math.max(
      8,
      Math.min(138, 113 - (position.z / FIELD_LENGTH) * 85),
    );
    const dx = -(target.x - position.x);
    const dy = -(target.z - position.z);
    const length = Math.hypot(dx, dy) || 1;
    const fx = dx / length;
    const fy = dy / length;
    this.cameraCone.setAttribute(
      "d",
      `M${x},${y} L${x + fx * 70 - fy * 30},${y + fy * 70 + fx * 30} L${x + fx * 70 + fy * 30},${y + fy * 70 - fx * 30} Z`,
    );
    this.cameraDot.setAttribute("cx", String(x));
    this.cameraDot.setAttribute("cy", String(y));
  }

  showRanking(ranking: RankedPlayer[]): void {
    this.rankingListEl.replaceChildren();
    for (const entry of ranking) {
      const row = document.createElement("div");
      row.className = "host-player-row";
      const name = document.createElement("span");
      name.textContent = `#${entry.rank} ${entry.name}`;
      const result = document.createElement("span");
      result.textContent = `${entry.distance.toFixed(1)} m · ${entry.outcome === "finished" ? "抵達" : entry.outcome === "eliminated" ? "淘汰" : "存活"}`;
      row.append(name, result);
      this.rankingListEl.appendChild(row);
    }
    this.rankingOverlay.hidden = false;
  }
}

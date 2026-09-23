import type {
  GhostState,
  PausedReason,
  PlayerSummary,
  RoomPhase,
} from "shared";

const TICKER_MAX_ITEMS = 5;
const TICKER_ITEM_MS = 4000;
const LEADERBOARD_SIZE = 3;

type TickerVariant = "caught" | "out" | "finish";

/**
 * 投影到大螢幕上的戲劇效果，疊在主辦方 3D 場景上（純顯示，不影響判定）：
 * - 中央上方的大字狀態：音樂播放時「前進！」、鬼回頭時「不准動！」、暫停時顯示原因。
 * - 左下角跑馬燈：誰被抓、誰出局、誰抵達終點。
 * - 左上角即時前三名。
 */
export class HostStageOverlay {
  private readonly banner = document.createElement("div");
  private readonly ticker = document.createElement("ol");
  private readonly leaderboard = document.createElement("ol");
  private bannerKey = "";
  private leaderboardKey = "";

  constructor(viewport: HTMLElement) {
    this.banner.className = "stage-banner";
    this.banner.setAttribute("role", "status");
    this.banner.setAttribute("aria-live", "polite");
    this.banner.hidden = true;
    this.ticker.className = "stage-ticker";
    this.ticker.setAttribute("aria-label", "場上動態");
    this.leaderboard.className = "stage-top3";
    this.leaderboard.setAttribute("aria-label", "即時前三名");
    this.leaderboard.hidden = true;
    viewport.append(this.banner, this.ticker, this.leaderboard);
  }

  /** 每幀呼叫；只有狀態真的改變時才動 DOM。 */
  setStatus(
    phase: RoomPhase,
    ghostState: GhostState,
    pausedReason?: PausedReason,
  ): void {
    let key: string;
    let text: string;
    if (phase === "PAUSED") {
      key = `paused-${pausedReason ?? "host"}`;
      text =
        pausedReason === "host-disconnected"
          ? "⏸ 主控台斷線，已自動暫停"
          : "⏸ 暫停中";
    } else if (phase !== "PLAYING") {
      key = "hidden";
      text = "";
    } else if (ghostState === "LOOK_AWAY") {
      key = "go";
      text = "▶ 前進！";
    } else if (ghostState === "TURNING_AWAY") {
      key = "hidden";
      text = "";
    } else {
      key = "freeze";
      text = "✋ 不准動！";
    }
    if (key === this.bannerKey) return;
    this.bannerKey = key;
    this.banner.hidden = key === "hidden";
    this.banner.dataset.status = key.startsWith("paused") ? "paused" : key;
    this.banner.textContent = text;
  }

  announceCaught(name: string): void {
    this.push(`💥 ${name} 被抓到了！`, "caught");
  }

  announceEliminated(name: string): void {
    this.push(`💀 ${name} 出局！`, "out");
  }

  announceFinished(name: string, place: number): void {
    this.push(`🏆 ${name} 抵達終點！第 ${place} 名`, "finish");
  }

  clearTicker(): void {
    this.ticker.replaceChildren();
  }

  setLeaderboard(players: PlayerSummary[], phase: RoomPhase): void {
    const visible = phase === "PLAYING" || phase === "PAUSED";
    const top = visible ? rankLive(players).slice(0, LEADERBOARD_SIZE) : [];
    const key = top
      .map((p) => `${p.playerId}:${p.finished ? "F" : p.distance.toFixed(1)}`)
      .join("|");
    if (key === this.leaderboardKey) return;
    this.leaderboardKey = key;
    this.leaderboard.hidden = top.length === 0;
    this.leaderboard.replaceChildren(
      ...top.map((player, index) => {
        const item = document.createElement("li");
        const medal = document.createElement("span");
        medal.className = "stage-top3-medal";
        medal.textContent = ["🥇", "🥈", "🥉"][index];
        const name = document.createElement("strong");
        name.textContent = player.name;
        const detail = document.createElement("span");
        detail.textContent = player.finished
          ? "抵達"
          : `${player.distance.toFixed(1)} m`;
        item.append(medal, name, detail);
        return item;
      }),
    );
  }

  private push(text: string, variant: TickerVariant): void {
    const item = document.createElement("li");
    item.dataset.variant = variant;
    item.textContent = text;
    this.ticker.prepend(item);
    while (this.ticker.children.length > TICKER_MAX_ITEMS)
      this.ticker.lastElementChild?.remove();
    window.setTimeout(() => item.remove(), TICKER_ITEM_MS);
  }
}

/** 場上即時排序：已抵達的依抵達先後，其餘存活者依距離；淘汰者不上榜。 */
export function rankLive(players: PlayerSummary[]): PlayerSummary[] {
  return players
    .filter((p) => p.finished || !p.eliminated)
    .sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished)
        return (a.finishedAtMs ?? 0) - (b.finishedAtMs ?? 0);
      return b.distance - a.distance;
    });
}

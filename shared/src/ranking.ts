/**
 * 遊戲結算排名（對應 PRD 第 11 章）：
 * 1. 完成的玩家依完成先後排最前面
 * 2. 尚未完成但存活的玩家依距離終點遠近排序
 * 3. 淘汰的玩家排在存活玩家之後，內部也依距離排序
 *
 * 純函式，不依賴時間/亂數，方便單元測試。
 */
export type RankingOutcome = "finished" | "surviving" | "eliminated";

export interface RankingInput {
  playerId: string;
  name: string;
  distance: number;
  score: number;
  finished: boolean;
  eliminated: boolean;
  /** 伺服器端遞增的結算序號，只有 finished 的玩家需要有意義的值，用來在完成玩家之間排序（避免用 wall-clock 造成同毫秒排序問題）。 */
  finishSeq?: number;
  /** 純顯示用，不參與排序。 */
  finishedAtMs?: number;
}

export interface RankedPlayer {
  rank: number;
  playerId: string;
  name: string;
  outcome: RankingOutcome;
  distance: number;
  score: number;
  finishedAtMs?: number;
}

export function computeRanking(players: RankingInput[]): RankedPlayer[] {
  const finished = players.filter((p) => p.finished);
  const eliminated = players.filter((p) => !p.finished && p.eliminated);
  const surviving = players.filter((p) => !p.finished && !p.eliminated);

  finished.sort((a, b) => (a.finishSeq ?? 0) - (b.finishSeq ?? 0));
  surviving.sort((a, b) => b.distance - a.distance);
  eliminated.sort((a, b) => b.distance - a.distance);

  const ordered = [...finished, ...surviving, ...eliminated];
  return ordered.map((p, index) => ({
    rank: index + 1,
    playerId: p.playerId,
    name: p.name,
    outcome: p.finished ? "finished" : p.eliminated ? "eliminated" : "surviving",
    distance: p.distance,
    score: p.score,
    finishedAtMs: p.finishedAtMs,
  }));
}

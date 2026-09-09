import {
  DEFAULT_ROOM_SETTINGS,
  GhostAI,
  HIT_LOCKOUT_MS,
  MAX_STEP_EVENTS_PER_WINDOW,
  MAX_GAME_DURATION_MS,
  MAX_PLAYERS_PER_ROOM,
  Player,
  RECONNECT_GRACE_MS,
  STEP_RATE_LIMIT_WINDOW_MS,
  SPEED_BOOST_CHECK_INTERVAL_MS,
  SPEED_BOOST_DURATION_MS,
  SPEED_BOOST_MULTIPLIER,
  SPEED_BOOST_CHANCE,
  STEP_DISTANCE_M,
  computeRanking,
  type Foot,
  type GameOverReason,
  type JoinErrorCode,
  type PlayerSummary,
  type RankedPlayer,
  type RoomPhase,
  type RoomSettings,
  type RoomStateSnapshot,
  type StepErrorCode,
  type StepResultMsg,
} from "shared";
import { randomBytes } from "node:crypto";

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface ServerPlayerState {
  playerId: string;
  sessionToken: string;
  name: string;
  player: Player;
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
  disconnectedPermanently: boolean;
  finishSeq?: number;
  finishedAtMs?: number;
  joinOrder: number;
  /** 隨機加速排程（PRD 22.2）：下次檢定時間、以及目前加速視窗的到期時間（null＝未加速）。 */
  nextBoostRollAt: number;
  boostActiveUntil: number | null;
  /** 中槍後的「聖人模式」保護期到期時間（null＝目前沒有保護期）。 */
  hitLockedUntil: number | null;
  lastClientSeq: number;
  lastStepResult: { clientSeq: number; result: StepResultMsg } | null;
  stepWindowStartedAt: number;
  stepEventsInWindow: number;
}

export type RoomEvent =
  | { type: "phaseChanged" }
  | { type: "ghostStateChanged" }
  | { type: "gameOver"; reason: GameOverReason }
  | {
      type: "playerConnectionChanged";
      playerId: string;
      connected: boolean;
      timedOut?: boolean;
    }
  | {
      type: "playerBoostChanged";
      playerId: string;
      boosted: boolean;
      untilMs?: number;
    };

function toStepResultMsg(
  result:
    | { kind: "rejected-no-alternate" }
    | { kind: "caught"; scoreAfter: number; eliminated: boolean }
    | { kind: "advanced"; distanceAfter: number; finished: boolean },
  finishedAtMs: number | undefined,
): StepResultMsg {
  if (result.kind === "advanced" && result.finished) {
    return { ...result, finishedAtMs };
  }
  return result;
}

/**
 * 一個房間的完整權威狀態機：WAITING -> PLAYING -> GAME_OVER（可在 PLAYING 期間進入 PAUSED）。
 * 刻意不直接碰 socket.io——所有時間都透過參數注入的 `now`，方便單元測試；
 * 實際的廣播由呼叫端（server/src/index.ts 的 tick 迴圈與 sockets/*Handlers.ts）根據回傳的 RoomEvent[] 決定怎麼發送。
 */
export class GameRoom {
  readonly code: string;
  readonly hostId: string;
  private readonly hostSessionToken = createSessionToken();
  hostSocketId: string | null = null;

  phase: RoomPhase = "WAITING";
  players = new Map<string, ServerPlayerState>();
  ghost: GhostAI | null = null;
  settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };

  private pausedAt: number | null = null;
  private roundStartedAt: number | null = null;
  private roundDeadlineAt: number | null = null;

  private lastRanking: RankedPlayer[] | null = null;
  private lastGameOverReason: GameOverReason | null = null;

  private nextJoinOrder = 0;
  private nextSettlementSeq = 0;
  private readonly rng: () => number;
  private readonly boostRng: () => number;

  /** boostRng 跟鬼的 rng 分開，兩個系統的隨機性互不干擾，也讓各自的單元測試好寫。 */
  constructor(
    code: string,
    hostId: string,
    rng: () => number = Math.random,
    boostRng: () => number = Math.random,
  ) {
    this.code = code;
    this.hostId = hostId;
    this.rng = rng;
    this.boostRng = boostRng;
  }

  /**
   * 主辦方調整這一場的血量、玩家玩法與終點距離。只在 WAITING 階段開放：開打後才換數值會讓已經扣過血的玩家
   * 跟後來的判定基準不一致。套用後把已在房裡的玩家一併重設，確保所有人起始血量相同。
   */
  updateSettings(
    settings: RoomSettings,
  ): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "WAITING")
      return { ok: false, error: "ROOM_NOT_WAITING" };
    this.settings = settings;
    for (const p of this.players.values()) {
      p.player.configure(
        settings.maxScore,
        STEP_DISTANCE_M,
        settings.finishDistanceM,
      );
    }
    return { ok: true };
  }

  /** 加入或重新加入房間。同一個 playerId 已存在時一律視為重連，不受「開始後禁止加入」限制。 */
  join(
    playerId: string,
    name: string,
  ): { ok: true } | { ok: false; error: JoinErrorCode } {
    const existing = this.players.get(playerId);
    if (existing) {
      if (existing.disconnectedPermanently)
        return { ok: false, error: "SESSION_INVALID" };
      existing.connected = true;
      existing.disconnectedAt = null;
      existing.disconnectedPermanently = false;
      return { ok: true };
    }

    if (this.phase !== "WAITING") {
      return { ok: false, error: "GAME_ALREADY_STARTED" };
    }
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 10) {
      return { ok: false, error: "NAME_INVALID" };
    }
    const lower = trimmed.toLowerCase();
    for (const p of this.players.values()) {
      if (p.name.toLowerCase() === lower)
        return { ok: false, error: "NAME_TAKEN" };
    }
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) {
      return { ok: false, error: "ROOM_FULL" };
    }

    const player = new Player(
      { isLooking: () => this.ghost?.isLooking() ?? false },
      this.settings.maxScore,
      STEP_DISTANCE_M,
      this.settings.finishDistanceM,
    );
    this.players.set(playerId, {
      playerId,
      sessionToken: createSessionToken(),
      name: trimmed,
      player,
      socketId: null,
      connected: true,
      disconnectedAt: null,
      disconnectedPermanently: false,
      joinOrder: this.nextJoinOrder++,
      nextBoostRollAt: Infinity,
      boostActiveUntil: null,
      hitLockedUntil: null,
      lastClientSeq: -1,
      lastStepResult: null,
      stepWindowStartedAt: 0,
      stepEventsInWindow: 0,
    });
    return { ok: true };
  }

  getHostSessionToken(): string {
    return this.hostSessionToken;
  }

  getPlayerSessionToken(playerId: string): string | undefined {
    return this.players.get(playerId)?.sessionToken;
  }

  resumeHost(
    sessionToken: string,
    socketId: string,
  ): { ok: true } | { ok: false; error: "SESSION_INVALID" } {
    if (sessionToken !== this.hostSessionToken)
      return { ok: false, error: "SESSION_INVALID" };
    this.attachHostSocket(socketId);
    return { ok: true };
  }

  resumePlayer(
    playerId: string,
    sessionToken: string,
    socketId: string,
  ): { ok: true } | { ok: false; error: "SESSION_INVALID" } {
    const p = this.players.get(playerId);
    if (!p || p.sessionToken !== sessionToken || p.disconnectedPermanently) {
      return { ok: false, error: "SESSION_INVALID" };
    }
    p.connected = true;
    p.disconnectedAt = null;
    p.socketId = socketId;
    return { ok: true };
  }

  attachSocket(playerId: string, socketId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      p.socketId = socketId;
      p.connected = true;
      p.disconnectedAt = null;
    }
  }

  attachHostSocket(socketId: string): void {
    this.hostSocketId = socketId;
  }

  markPlayerDisconnected(
    playerId: string,
    now: number,
    socketId?: string,
  ): boolean {
    const p = this.players.get(playerId);
    if (!p) return false;
    if (socketId !== undefined && p.socketId !== socketId) return false;
    p.connected = false;
    p.socketId = null;
    p.disconnectedAt = now;
    return true;
  }

  markHostDisconnected(socketId?: string): boolean {
    if (socketId !== undefined && this.hostSocketId !== socketId) return false;
    this.hostSocketId = null;
    return true;
  }

  startGame(now: number): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "WAITING")
      return { ok: false, error: "ROOM_NOT_WAITING" };
    this.beginPlaying(now);
    return { ok: true };
  }

  pause(now: number): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "PLAYING")
      return { ok: false, error: "ROOM_NOT_PLAYING" };
    this.phase = "PAUSED";
    this.pausedAt = now;
    return { ok: true };
  }

  resume(now: number): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "PAUSED" || this.pausedAt === null)
      return { ok: false, error: "ROOM_NOT_PAUSED" };
    const delta = now - this.pausedAt;
    this.ghost?.shiftClock(delta);
    if (this.roundDeadlineAt !== null) this.roundDeadlineAt += delta;
    for (const p of this.players.values()) {
      p.nextBoostRollAt += delta;
      if (p.boostActiveUntil !== null) p.boostActiveUntil += delta;
      if (p.hitLockedUntil !== null) p.hitLockedUntil += delta;
    }
    this.pausedAt = null;
    this.phase = "PLAYING";
    return { ok: true };
  }

  /** 主辦方「結束遊戲」：不論目前在哪個階段（PLAYING/PAUSED）直接強制結算。 */
  forceEndGame(): { ok: true } | { ok: false; error: string } {
    if (this.phase === "WAITING" || this.phase === "GAME_OVER") {
      return { ok: false, error: "ROOM_NOT_ACTIVE" };
    }
    this.endGame("host-ended");
    return { ok: true };
  }

  /** 重置回 WAITING（房號/名單保留），移除已永久離線的玩家；需要主辦方再按一次「開始遊戲」。 */
  restart(): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "GAME_OVER")
      return { ok: false, error: "ROOM_NOT_GAME_OVER" };
    for (const [id, p] of [...this.players]) {
      if (p.disconnectedPermanently) {
        this.players.delete(id);
        continue;
      }
      p.player.reset();
      p.finishSeq = undefined;
      p.finishedAtMs = undefined;
      p.nextBoostRollAt = Infinity;
      p.boostActiveUntil = null;
      p.hitLockedUntil = null;
      p.lastClientSeq = -1;
      p.lastStepResult = null;
      p.stepWindowStartedAt = 0;
      p.stepEventsInWindow = 0;
    }
    this.ghost = null;
    this.phase = "WAITING";
    this.lastRanking = null;
    this.lastGameOverReason = null;
    this.roundStartedAt = null;
    this.roundDeadlineAt = null;
    this.pausedAt = null;
    return { ok: true };
  }

  applyStep(
    playerId: string,
    foot: Foot,
    now: number,
    clientSeq?: number,
  ):
    | {
        ok: true;
        result: StepResultMsg;
        ghostChanged: boolean;
        concluded: GameOverReason | null;
        duplicate?: boolean;
      }
    | { ok: false; error: StepErrorCode } {
    const state = this.players.get(playerId);
    if (!state) {
      return { ok: false, error: "UNKNOWN_PLAYER" };
    }
    // 即使遊戲剛好在重試前結束，相同 sequence 仍回傳原結果，避免網路重送造成語意改變。
    if (
      clientSeq !== undefined &&
      state.lastStepResult?.clientSeq === clientSeq
    ) {
      return {
        ok: true,
        result: state.lastStepResult.result,
        ghostChanged: false,
        concluded: null,
        duplicate: true,
      };
    }
    if (this.phase !== "PLAYING" || !this.ghost) {
      return { ok: false, error: "ROOM_NOT_PLAYING" };
    }
    if (!state.connected) {
      return { ok: false, error: "NOT_AUTHENTICATED" };
    }

    if (clientSeq !== undefined) {
      if (clientSeq <= state.lastClientSeq)
        return { ok: false, error: "DUPLICATE_STEP" };
      if (now - state.stepWindowStartedAt >= STEP_RATE_LIMIT_WINDOW_MS) {
        state.stepWindowStartedAt = now;
        state.stepEventsInWindow = 0;
      }
      if (state.stepEventsInWindow >= MAX_STEP_EVENTS_PER_WINDOW) {
        return { ok: false, error: "RATE_LIMITED" };
      }
      state.lastClientSeq = clientSeq;
      state.stepEventsInWindow += 1;
    }

    const beforeGhostState = this.ghost.getState();
    this.ghost.update(now);
    const ghostChanged = this.ghost.getState() !== beforeGhostState;

    if (state.hitLockedUntil !== null) {
      if (now < state.hitLockedUntil) {
        // 中槍後的「聖人模式」保護期：直接忽略這次踏步，不進 Player.step()，
        // 所以既不會扣血也不會前進。
        const lockedResult: StepResultMsg = {
          kind: "locked",
          remainingMs: state.hitLockedUntil - now,
        };
        if (clientSeq !== undefined)
          state.lastStepResult = { clientSeq, result: lockedResult };
        return {
          ok: true,
          result: lockedResult,
          ghostChanged,
          concluded: null,
        };
      }
      state.hitLockedUntil = null;
    }

    const multiplier = this.isPlayerBoosted(state, now)
      ? SPEED_BOOST_MULTIPLIER
      : 1;
    const result = state.player.step(foot, multiplier);
    if (result.kind === "advanced" && result.finished) {
      state.finishSeq = this.nextSettlementSeq++;
      state.finishedAtMs = now;
    }
    if (result.kind === "caught") {
      state.hitLockedUntil = now + HIT_LOCKOUT_MS;
    }

    const concluded = this.checkForConclusion(now);
    if (clientSeq !== undefined)
      state.lastStepResult = {
        clientSeq,
        result: toStepResultMsg(result, state.finishedAtMs),
      };
    return {
      ok: true,
      result: toStepResultMsg(result, state.finishedAtMs),
      ghostChanged,
      concluded,
    };
  }

  /** 由外層的全域 tick 迴圈每 SERVER_TICK_MS 呼叫一次，推進鬼的狀態/斷線寬限期/時間上限。 */
  tick(now: number): RoomEvent[] {
    const events: RoomEvent[] = [];

    for (const p of this.players.values()) {
      if (
        !p.connected &&
        !p.disconnectedPermanently &&
        p.disconnectedAt !== null &&
        now - p.disconnectedAt >= RECONNECT_GRACE_MS
      ) {
        p.disconnectedPermanently = true;
        p.player.eliminated = true;
        events.push({
          type: "playerConnectionChanged",
          playerId: p.playerId,
          connected: false,
          timedOut: true,
        });
      }
    }

    if (this.phase === "PLAYING" && this.ghost) {
      const before = this.ghost.getState();
      this.ghost.update(now);
      if (this.ghost.getState() !== before)
        events.push({ type: "ghostStateChanged" });

      this.updateSpeedBoosts(now, events);

      const reason = this.checkForConclusion(now);
      if (reason) events.push({ type: "gameOver", reason });
    }

    return events;
  }

  /** PRD 22.2 隨機加速：每位還在場上的玩家獨立排程，到期就擲一次機率決定要不要給一段加速視窗。 */
  private updateSpeedBoosts(now: number, events: RoomEvent[]): void {
    for (const p of this.players.values()) {
      if (p.player.eliminated || p.player.finished) continue;

      if (p.boostActiveUntil !== null && now >= p.boostActiveUntil) {
        p.boostActiveUntil = null;
        events.push({
          type: "playerBoostChanged",
          playerId: p.playerId,
          boosted: false,
        });
      }

      if (now >= p.nextBoostRollAt) {
        p.nextBoostRollAt = now + SPEED_BOOST_CHECK_INTERVAL_MS;
        if (
          p.boostActiveUntil === null &&
          this.boostRng() < SPEED_BOOST_CHANCE
        ) {
          p.boostActiveUntil = now + SPEED_BOOST_DURATION_MS;
          events.push({
            type: "playerBoostChanged",
            playerId: p.playerId,
            boosted: true,
            untilMs: p.boostActiveUntil,
          });
        }
      }
    }
  }

  private isPlayerBoosted(p: ServerPlayerState, now: number): boolean {
    return p.boostActiveUntil !== null && now < p.boostActiveUntil;
  }

  private beginPlaying(now: number): void {
    this.phase = "PLAYING";
    this.ghost = new GhostAI(now, this.rng);
    this.roundStartedAt = now;
    this.roundDeadlineAt = now + MAX_GAME_DURATION_MS;
    for (const p of this.players.values()) {
      p.nextBoostRollAt = now + SPEED_BOOST_CHECK_INTERVAL_MS;
      p.boostActiveUntil = null;
      p.hitLockedUntil = null;
    }
  }

  private checkForConclusion(now: number): GameOverReason | null {
    if (this.players.size === 0) return null;
    const states = [...this.players.values()];
    const allConcluded = states.every(
      (p) => p.player.finished || p.player.eliminated,
    );
    if (allConcluded) {
      const allFinished = states.every((p) => p.player.finished);
      this.endGame(allFinished ? "all-finished" : "all-eliminated");
      return this.lastGameOverReason;
    }
    if (this.roundDeadlineAt !== null && now >= this.roundDeadlineAt) {
      this.endGame("time-limit");
      return this.lastGameOverReason;
    }
    return null;
  }

  private endGame(reason: GameOverReason): void {
    this.phase = "GAME_OVER";
    this.lastRanking = computeRanking(
      [...this.players.values()].map((p) => ({
        playerId: p.playerId,
        name: p.name,
        distance: p.player.distance,
        score: p.player.score,
        finished: p.player.finished,
        eliminated: p.player.eliminated,
        finishSeq: p.finishSeq,
        finishedAtMs: p.finishedAtMs,
      })),
    );
    this.lastGameOverReason = reason;
  }

  getLastRanking(): RankedPlayer[] {
    return this.lastRanking ?? [];
  }

  getLastGameOverReason(): GameOverReason {
    return this.lastGameOverReason ?? "host-ended";
  }

  toSnapshot(now: number): RoomStateSnapshot {
    return {
      roomCode: this.code,
      phase: this.phase,
      players: [...this.players.values()]
        .sort((a, b) => a.joinOrder - b.joinOrder)
        .map((p) => this.toPlayerSummary(p, now)),
      ghost: this.ghost
        ? {
            state: this.ghost.getState(),
            stateStartedAtMs: this.ghost.getStateStartedAt(),
            stateDurationMs: this.ghost.getStateDuration(),
            musicCycle: this.ghost.getMusicCycle(),
            musicPlaybackRate: this.ghost.getMusicPlaybackRate(),
          }
        : null,
      serverNowMs: now,
      roundStartedAtMs: this.roundStartedAt ?? undefined,
      roundDeadlineMs: this.roundDeadlineAt ?? undefined,
      settings: this.settings,
    };
  }

  private toPlayerSummary(p: ServerPlayerState, now: number): PlayerSummary {
    return {
      playerId: p.playerId,
      name: p.name,
      score: p.player.score,
      distance: p.player.distance,
      eliminated: p.player.eliminated,
      finished: p.player.finished,
      finishedAtMs: p.finishedAtMs,
      connected: p.connected,
      disconnectedPermanently: p.disconnectedPermanently || undefined,
      boosted: this.isPlayerBoosted(p, now) || undefined,
    };
  }

  /** 房間是否已經沒有任何連線中的人（玩家與主辦方皆已離線），供 RoomManager 做資源回收判斷。 */
  isAbandoned(): boolean {
    if (this.hostSocketId !== null) return false;
    for (const p of this.players.values()) {
      if (p.connected) return false;
    }
    return true;
  }
}

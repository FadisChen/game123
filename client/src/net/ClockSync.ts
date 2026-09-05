/**
 * 用伺服器廣播的 serverNowMs 估計本機時鐘跟伺服器的偏移量，供顯示動畫用（GhostReplicaAI 的插值計算）。
 * 不做 RTT 補償——所有真正的判定都在伺服器端，視覺上幾十毫秒的誤差不影響公平性。
 */
export class ClockSync {
  private offsetMs = 0;

  updateFromServerNow(serverNowMs: number): void {
    this.offsetMs = serverNowMs - Date.now();
  }

  nowServerMs(): number {
    return Date.now() + this.offsetMs;
  }
}

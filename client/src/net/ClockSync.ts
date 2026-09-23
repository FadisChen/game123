const CALIBRATION_SAMPLES = 5;

/**
 * 估計本機時鐘跟伺服器的偏移量，供顯示動畫（GhostReplicaAI 插值）、開場倒數與主控台音樂對拍使用。
 *
 * 兩種來源：
 * - calibrate()：主動送幾次 time:sync，取來回延遲（RTT）最小的那次，以「伺服器時間 + RTT/2」
 *   補償單程延遲。音樂對拍靠這個才不會整體晚一個網路延遲。
 * - updateFromServerNow()：廣播事件附帶的 serverNowMs。它是伺服器送出的時間點，到達時已經晚了
 *   單程延遲，所以只在還沒有校正結果時當作備援。
 *
 * 所有真正的判定都在伺服器端，這裡的誤差只影響畫面與音樂。
 */
export class ClockSync {
  private offsetMs = 0;
  private calibrated = false;
  private calibrating: Promise<void> | null = null;

  updateFromServerNow(serverNowMs: number): void {
    if (this.calibrated) return;
    this.offsetMs = serverNowMs - Date.now();
  }

  /** requestServerNow：送出 time:sync 並回傳伺服器時間（見 SocketClient.serverNow）。失敗時保留原本的偏移量。 */
  calibrate(requestServerNow: () => Promise<number>): Promise<void> {
    this.calibrating ??= this.runCalibration(requestServerNow).finally(() => {
      this.calibrating = null;
    });
    return this.calibrating;
  }

  private async runCalibration(
    requestServerNow: () => Promise<number>,
  ): Promise<void> {
    let bestRtt = Infinity;
    let bestOffset = this.offsetMs;
    for (let i = 0; i < CALIBRATION_SAMPLES; i++) {
      const sentAt = Date.now();
      let serverNowMs: number;
      try {
        serverNowMs = await requestServerNow();
      } catch {
        continue;
      }
      const receivedAt = Date.now();
      const rtt = receivedAt - sentAt;
      if (rtt < bestRtt) {
        bestRtt = rtt;
        bestOffset = serverNowMs + rtt / 2 - receivedAt;
      }
    }
    if (Number.isFinite(bestRtt)) {
      this.offsetMs = bestOffset;
      this.calibrated = true;
    }
  }

  nowServerMs(): number {
    return Date.now() + this.offsetMs;
  }
}

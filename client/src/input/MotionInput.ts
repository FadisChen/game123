import type { Foot } from "shared";

const MOTION_TRIGGER_MPS2 = 3;
const MOTION_RELEASE_MPS2 = 1;
const MOTION_MIN_INTERVAL_MS = 350;
const MOTION_BASELINE_ALPHA = 0.08;
const MOTION_WARMUP_SAMPLES = 6;
const MOTION_SENSOR_TIMEOUT_MS = 1500;

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

function oppositeFoot(foot: Foot): Foot {
  return foot === "left" ? "right" : "left";
}

function isSecureMotionContext(): boolean {
  return (
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}

/**
 * 把手機的垂直晃動轉成離散步進。以回到基準值重新 armed 的方式避免一次完整晃動觸發兩步，
 * 不把原始感測值送到伺服器；伺服器收到的仍然只是一般的 left/right 步進意圖。
 */
export class MotionInput {
  private readonly onStep: (foot: Foot) => void;
  private readonly onAvailabilityChange?: (available: boolean) => void;
  private listening = false;
  private armed = true;
  private baseline: number | null = null;
  private warmupSamples = MOTION_WARMUP_SAMPLES;
  private lastTriggerAt = -Infinity;
  private nextFoot: Foot = "left";
  private sensorTimeoutId: number | undefined;
  private receivedSensorSample = false;
  private gameplayActive = false;
  private wakeLockSentinel: WakeLockSentinel | null = null;

  constructor(
    onStep: (foot: Foot) => void,
    onAvailabilityChange?: (available: boolean) => void,
  ) {
    this.onStep = onStep;
    this.onAvailabilityChange = onAvailabilityChange;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.syncWakeLock();
    });
  }

  async requestPermission(): Promise<boolean> {
    if (!isSecureMotionContext() || !("DeviceMotionEvent" in window))
      return false;

    const motionEvent =
      window.DeviceMotionEvent as DeviceMotionEventWithPermission;
    if (typeof motionEvent.requestPermission === "function") {
      try {
        if ((await motionEvent.requestPermission()) !== "granted") return false;
      } catch {
        return false;
      }
    }

    this.start();
    return true;
  }

  setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
    window.clearTimeout(this.sensorTimeoutId);
    this.sensorTimeoutId = undefined;
    if (active && this.listening) {
      this.sensorTimeoutId = window.setTimeout(() => {
        if (
          this.receivedSensorSample ||
          !this.listening ||
          !this.gameplayActive
        )
          return;
        this.stop();
        this.onAvailabilityChange?.(false);
      }, MOTION_SENSOR_TIMEOUT_MS);
    }
    this.syncWakeLock();
  }

  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.receivedSensorSample = false;
    this.resetSignal();
    window.addEventListener("devicemotion", this.handleMotion);
  }

  stop(): void {
    if (!this.listening) return;
    this.listening = false;
    this.gameplayActive = false;
    window.removeEventListener("devicemotion", this.handleMotion);
    window.clearTimeout(this.sensorTimeoutId);
    this.sensorTimeoutId = undefined;
    this.resetSignal();
    this.releaseWakeLock();
  }

  resetSequence(): void {
    this.nextFoot = "left";
  }

  /** 以伺服器回傳的腳重新校正下一腳，避免延遲或重連後左右腳游標漂移。 */
  reconcileStep(foot: Foot): void {
    this.nextFoot = oppositeFoot(foot);
  }

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const value = this.readVerticalAcceleration(event);
    if (value === null) return;
    this.receivedSensorSample = true;
    window.clearTimeout(this.sensorTimeoutId);
    this.sensorTimeoutId = undefined;

    if (this.baseline === null) this.baseline = value;
    const delta = value - this.baseline;
    this.baseline += delta * MOTION_BASELINE_ALPHA;

    if (this.warmupSamples > 0) {
      this.warmupSamples -= 1;
      return;
    }

    const now = performance.now();
    if (!this.armed) {
      if (
        Math.abs(delta) <= MOTION_RELEASE_MPS2 &&
        now - this.lastTriggerAt >= MOTION_MIN_INTERVAL_MS
      )
        this.armed = true;
      return;
    }
    if (
      Math.abs(delta) < MOTION_TRIGGER_MPS2 ||
      now - this.lastTriggerAt < MOTION_MIN_INTERVAL_MS
    )
      return;

    this.armed = false;
    this.lastTriggerAt = now;
    const foot = this.nextFoot;
    this.nextFoot = oppositeFoot(foot);
    this.onStep(foot);
  };

  private readVerticalAcceleration(event: DeviceMotionEvent): number | null {
    const acceleration = event.acceleration;
    const source =
      acceleration?.x !== null &&
      acceleration?.x !== undefined &&
      acceleration?.y !== null &&
      acceleration?.y !== undefined
        ? acceleration
        : event.accelerationIncludingGravity;
    if (
      source?.x === null ||
      source?.y === null ||
      source?.x === undefined ||
      source?.y === undefined
    )
      return null;

    const angle = ((screen.orientation?.angle ?? 0) + 360) % 360;
    if (angle === 90) return source.x;
    if (angle === 270) return -source.x;
    if (angle === 180) return -source.y;
    return source.y;
  }

  private syncWakeLock(): void {
    if (this.gameplayActive && this.listening) void this.requestWakeLock();
    else this.releaseWakeLock();
  }

  private async requestWakeLock(): Promise<void> {
    if (
      this.wakeLockSentinel ||
      document.visibilityState !== "visible" ||
      !isSecureMotionContext() ||
      !("wakeLock" in navigator)
    )
      return;

    try {
      this.wakeLockSentinel = await navigator.wakeLock.request("screen");
      this.wakeLockSentinel.addEventListener("release", () => {
        this.wakeLockSentinel = null;
      });
    } catch {
      this.wakeLockSentinel = null;
    }
  }

  private releaseWakeLock(): void {
    void this.wakeLockSentinel?.release();
    this.wakeLockSentinel = null;
  }

  private resetSignal(): void {
    this.armed = true;
    this.baseline = null;
    this.warmupSamples = MOTION_WARMUP_SAMPLES;
    this.lastTriggerAt = -Infinity;
  }
}

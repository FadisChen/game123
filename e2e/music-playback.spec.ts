import { test, expect, type Page } from "@playwright/test";

type FakeAudio = {
  src: string;
  loop: boolean;
  duration: number;
  currentTime: number;
  paused: boolean;
  ended: boolean;
  playCalls: number;
  play(): Promise<void>;
  pause(): void;
  finish(): void;
  addEventListener(): void;
};

declare global {
  interface Window {
    musicAudioInstances: FakeAudio[];
  }
}

async function installFakeAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeAudioElement {
      src: string;
      loop = false;
      duration = 1;
      currentTime = 0;
      paused = true;
      ended = false;
      playCalls = 0;

      constructor(src = "") {
        this.src = src;
      }

      play(): Promise<void> {
        this.playCalls += 1;
        this.paused = false;
        this.ended = false;
        return Promise.resolve();
      }

      pause(): void {
        this.paused = true;
      }

      finish(): void {
        this.currentTime = this.duration;
        this.paused = true;
        this.ended = true;
      }

      addEventListener(): void {}
    }

    window.musicAudioInstances = [];
    Object.defineProperty(window, "Audio", {
      configurable: true,
      writable: true,
      value: function (src?: string) {
        const audio = new FakeAudioElement(src);
        window.musicAudioInstances.push(audio);
        return audio;
      },
    });
  });
}

test("music tracks do not replay after reaching the end", async ({ page }) => {
  await installFakeAudio(page);
  await page.goto("/host.html");

  const playback = await page.evaluate(async () => {
    const { MusicPlayer } = await import("/src/game/audio.ts");

    const playOnce = (state: "LOOK_AWAY" | "LOOKING", source: string) => {
      const before = window.musicAudioInstances.length;
      const player = new MusicPlayer();
      const ghost = {
        state,
        stateStartedAtMs: 0,
        stateDurationMs: 10_000,
        musicCycle: 0,
        musicPlaybackRate: 1,
      };

      player.sync(ghost, "PLAYING", 0);
      const audio = window.musicAudioInstances
        .slice(before)
        .find((instance) => instance.src.includes(source))!;
      const initialPlayCalls = audio.playCalls;
      audio.finish();
      player.sync(ghost, "PLAYING", 1_500);

      return {
        initialPlayCalls,
        playCallsAfterFinish: audio.playCalls,
        loop: audio.loop,
      };
    };

    return {
      away: playOnce("LOOK_AWAY", "123%E6%9C%A8%E9%A0%AD%E4%BA%BA.mp3"),
      looking: playOnce("LOOKING", "sleeping_wave.mp3"),
    };
  });

  expect(playback).toEqual({
    away: { initialPlayCalls: 1, playCallsAfterFinish: 1, loop: false },
    looking: { initialPlayCalls: 1, playCallsAfterFinish: 1, loop: false },
  });
});

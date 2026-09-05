/** 方向鎖定由瀏覽器決定是否支援；直向遮罩與輸入檢查始終生效。 */
export function isLandscape(): boolean {
  return window.matchMedia("(orientation: landscape)").matches;
}

export async function requestLandscape(fullscreenRequested = false): Promise<void> {
  if (!fullscreenRequested && !window.matchMedia("(pointer: coarse)").matches) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    await orientation?.lock?.("landscape");
  } catch {
    // iOS 與不允許鎖定的瀏覽器仍由遮罩要求使用者手動旋轉。
  }
}

export function installLandscapeGuard(app: HTMLElement): void {
  document.body.classList.add("player-page");
  const overlay = document.createElement("div");
  overlay.className = "landscape-guard";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "rotate-title");
  overlay.innerHTML = `<div class="rotate-device" aria-hidden="true">↻</div>
    <span class="eyebrow">123 木頭人</span>
    <h1 id="rotate-title">轉個方向，準備出發</h1>
    <p>請將裝置轉為橫向<br>雙手就位，才能開始遊戲。</p>
    <button class="primary-button" type="button">開啟橫向全螢幕</button>
    <small>若畫面沒有旋轉，請解除裝置的旋轉鎖定。</small>`;
  document.body.appendChild(overlay);
  const button = overlay.querySelector("button")!;
  button.addEventListener("click", () => void requestLandscape(true));
  const sync = () => {
    const portrait = !isLandscape();
    app.inert = portrait;
    overlay.hidden = !portrait;
    if (portrait && app.contains(document.activeElement)) button.focus();
  };
  window.matchMedia("(orientation: landscape)").addEventListener("change", sync);
  sync();
}

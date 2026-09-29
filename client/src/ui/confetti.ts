const CONFETTI_COLORS = [
  "#8deab0",
  "#e7a342",
  "#e8447a",
  "#fdd835",
  "#8ecae6",
  "#f4f4e9",
];
const CONFETTI_LIFETIME_MS = 3600;

/** 純 DOM 的彩帶：灑一批小紙片，動畫結束後自己清掉。減少動態效果的設定下由 CSS 整個隱藏。 */
export function burstConfetti(container: HTMLElement, count = 70): void {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 600}ms`;
    piece.style.animationDuration = `${2200 + Math.random() * 1200}ms`;
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty("--spin", `${(Math.random() - 0.5) * 1440}deg`);
    layer.appendChild(piece);
  }
  container.appendChild(layer);
  window.setTimeout(() => layer.remove(), CONFETTI_LIFETIME_MS + 700);
}

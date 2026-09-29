import {
  REACTION_COOLDOWN_MS,
  REACTION_EMOJIS,
  type ReactionEmoji,
} from "shared";

/** 比伺服器的冷卻稍長，網路抖動時第二下才不會在伺服器端被限流、卻在畫面上顯示已送出。 */
const CLIENT_COOLDOWN_MS = REACTION_COOLDOWN_MS + 150;

/**
 * 觀眾表情列：等待開局、已出局或已抵達時顯示在手機下方，點一下就飛到大螢幕上。
 * 能不能送由伺服器決定（GameRoom.react），這裡只做冷卻期間的按鈕回饋。
 */
export class ReactionBar {
  private readonly root = document.createElement("div");
  private readonly buttons: HTMLButtonElement[] = [];
  private coolingUntil = 0;

  constructor(container: HTMLElement, onReact: (emoji: ReactionEmoji) => void) {
    this.root.className = "reaction-bar";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "送表情到大螢幕");
    const label = document.createElement("span");
    label.className = "reaction-bar-label";
    label.textContent = "送到大螢幕";
    this.root.appendChild(label);
    for (const emoji of REACTION_EMOJIS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reaction-button";
      button.textContent = emoji;
      button.setAttribute("aria-label", `送出 ${emoji}`);
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        this.fire(button, emoji, onReact);
      });
      button.addEventListener("click", (event) => {
        if (event.detail === 0) this.fire(button, emoji, onReact);
      });
      this.buttons.push(button);
      this.root.appendChild(button);
    }
    this.root.hidden = true;
    container.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  private fire(
    button: HTMLButtonElement,
    emoji: ReactionEmoji,
    onReact: (emoji: ReactionEmoji) => void,
  ): void {
    const now = performance.now();
    if (now < this.coolingUntil) return;
    this.coolingUntil = now + CLIENT_COOLDOWN_MS;
    button.classList.remove("is-sent");
    void button.offsetWidth;
    button.classList.add("is-sent");
    this.root.classList.add("is-cooling");
    window.setTimeout(
      () => this.root.classList.remove("is-cooling"),
      CLIENT_COOLDOWN_MS,
    );
    onReact(emoji);
  }
}

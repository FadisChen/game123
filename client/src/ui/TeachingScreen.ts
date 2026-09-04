const RULES = ["鬼回頭時不能移動", "被發現會扣 1 分", "扣到 0 分即淘汰", "抵達終點線獲勝"];

/** 教學畫面（對應 PRD 10 章 TEACHING 狀態與美術參考圖的四格教學卡）。 */
export class TeachingScreen {
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement, onConfirm: () => void) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position:absolute; inset:0; background:#000000cc;
      display:flex; align-items:center; justify-content:center; z-index:10;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background:#333333; color:#f2f2f2; border-radius:20px;
      padding:28px 32px; max-width:min(420px, 86vw); text-align:center;
    `;

    const title = document.createElement("h1");
    title.textContent = "遊戲教學";
    title.style.cssText = "margin:0 0 16px; font-size:24px;";
    card.appendChild(title);

    const list = document.createElement("ol");
    list.style.cssText = "text-align:left; margin:0 0 24px; padding-left:1.4em; font-size:18px; line-height:1.8;";
    for (const rule of RULES) {
      const li = document.createElement("li");
      li.textContent = rule;
      list.appendChild(li);
    }
    card.appendChild(list);

    const button = document.createElement("button");
    button.textContent = "我知道了";
    button.style.cssText = `
      pointer-events:auto; border:none; border-radius:14px; background:#f94144; color:#fff;
      font-size:20px; font-weight:700; padding:12px 32px; cursor:pointer;
    `;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      onConfirm();
    });
    card.appendChild(button);

    this.root.appendChild(card);
    container.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }
}

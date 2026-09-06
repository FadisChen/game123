# 123 木頭人（Red Light, Green Light）

公司年會用的 3D「123 木頭人」多人連線小遊戲。手機當手把（左右腳按鍵或上下晃動前進），大螢幕當主辦方鳥瞰主控台，鬼會隨音樂節奏回頭抓正在動的人，最先抵達終點或活到最後的人獲勝。

- **玩家端**：手機瀏覽器掃 QR Code 加入房間，第一人稱視角；房間可選「主視角」按鍵或「感應式」上下晃動，一次晃動前進一步。感測器不可用時保留按鍵備援。
- **主辦方端**：投影到大螢幕的鳥瞰 3D 場景＋控制面板（房號、QR Code、玩家清單、開始/暫停/結束/重新開始、排名、鏡頭模式切換、房間設定調整）。開局前可調整分數上限、玩家操作模式與終點距離。
- **遊戲節奏**：開始後由主辦方裝置播放 `asserts/123木頭人.mp3`；音樂播放時可前進，音樂結束後鬼轉身，隨機審視 3～6 秒，再轉回去播放下一輪。每輪速度增加 0.1x，最高 2.0x。
- 判定完全在伺服器端做（移動距離、鬼有沒有在看、有沒有被抓、加速有沒有觸發），手機端只負責顯示與送出「我踩了左/右腳」的意圖，沒有作弊空間。

## 專案結構

npm workspaces monorepo：

```
game123/
  client/     # Vite + TypeScript + Three.js 前端，玩家端／主辦方端共用同一套 build
  server/     # Node.js + Express + Socket.IO 後端，唯一的權威判定來源
  shared/     # 前後端共用的純邏輯與型別（不額外編譯，前後端都直接讀 TS 原始碼）
  e2e/        # Playwright 端對端測試
  scripts/    # 壓力測試等維運用腳本
```

### `shared/` — 前後端共用邏輯

- `config.ts`：所有可調參數（鬼回頭時間、加速機率、房間人數上限、伺服器 tick 頻率…），前後端只有這一份，不會各自定義出不一致的數值。也定義了主辦方可調的房間設定 `RoomSettings`（分數上限、玩家模式、終點距離）與 `normalizeRoomSettings()`——伺服器收到主辦方送來的設定一律用這個函式重新驗證，超出允許範圍就退回預設值。
- `Player.ts`：左右腳交替規則、扣分/淘汰/抵達終點判定，**只由伺服器 instantiate**，是唯一的權威判定邏輯。
- `GhostAI.ts`：鬼的狀態機（`LOOK_AWAY → TURNING_TO_LOOK → LOOKING → TURNING_AWAY`）。音樂輪次與播放速度由伺服器廣播，假動作已移除。拆成兩個類別：
  - `GhostAI`：伺服器端權威版，會真的推進狀態、丟骰子。
  - `GhostReplicaAI`：客戶端純顯示版，沒有亂數也沒有 `update()`，完全由伺服器廣播的 `ghost:stateChanged` 驅動，**只能拿來做視覺效果，絕對不能拿來做任何判定**。
- `ranking.ts`：結算排名規則（抵達終點依完成順序、存活/淘汰依距離排序）。
- `protocol.ts`：Socket.IO 事件名稱與所有 payload 型別，前後端共用一份，避免訊息格式漂移。

### `server/` — 伺服器（Node.js + Express + Socket.IO）

- `src/index.ts`：起 Express（順便伺服 `client/dist` 靜態檔案與 `/`、`/host`、`/join/:code` 路由）+ Socket.IO，並用**單一全域 `setInterval`**（`SERVER_TICK_MS = 100ms`）推進所有房間的狀態，而不是每個房間各自一個計時器。
- `src/rooms/RoomManager.ts`：管理所有房間（`Map<房號, GameRoom>`），並負責回收長時間沒人連線的房間。
- `src/rooms/GameRoom.ts`：單一房間的完整權威狀態機（`WAITING → PLAYING → GAME_OVER`，`PLAYING` 期間可 `PAUSED`），包含鬼的推進、音樂輪次、隨機加速、斷線寬限期、結算排名等所有邏輯。
- `src/sockets/`：把 Socket.IO 的具名事件（見下方協定表）接到 `GameRoom`/`RoomManager` 上，並負責把結果廣播出去。

### `client/` — 前端（Vite + TypeScript + Three.js）

兩個獨立入口，共用同一份 3D 場景建置程式碼（`game/fieldEnvironment.ts`）與鬼的視覺呈現（`game/ghostVisual.ts`）：

- `player.html` / `main-player.ts`：玩家手機端。`ui/JoinScreen.ts`（輸入房號＋名字）→ `game/NetworkedGameController.ts`（把伺服器廣播轉譯成畫面/音效，本身不做任何判定）。網址帶 `?offline=1` 可以跳過連線，直接跑最早的單機版 `game/GameController.ts`（純調美術/音效時不用開伺服器）。
- `host.html` / `main-host.ts`：主辦方主控台。`host/HostController.ts` 統籌 `host/HostScene.ts`（鳥瞰 3D，玩家頭像用 `InstancedMesh` 一次 draw call 畫完，支援鳥瞰／跟隨領先者／跟隨落後者／自由拖曳四種鏡頭模式）與 `host/HostConsolePanel.ts`（房號、QR Code、玩家清單、控制按鈕、鏡頭模式選單、排名彈窗）。
- `net/SocketClient.ts`：對 `socket.io-client` 的薄封裝，把所有事件名稱/型別收斂到這一份。
- `net/ClockSync.ts`：用伺服器回報的時間戳算跟本機時間的偏移量，純顯示用，不影響判定公平性。
- `game/audio.ts`：保留 Web Audio API 合成的短音效，並以 `MusicPlayer` 同步主辦方端的 MP3 播放、暫停、恢復與播放速度。
- `input/MotionInput.ts`：在使用者確認教學時請求裝置感測器權限，將校正過的上下晃動轉成左右腳交替步進。

## Socket.IO 通訊協定

**Client → Server**（皆有 ack 回覆）：

| 事件                                                                      | 說明                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `host:createRoom`                                                         | 主辦方建立房間，伺服器回傳高熵 `hostSessionToken`                                                                          |
| `host:resumeRoom`                                                         | 主辦方以房號與 session token 恢復房間                                                                                      |
| `host:startGame` / `pauseGame` / `resumeGame` / `endGame` / `restartGame` | 主辦方控制房間狀態；身分取自 socket session                                                                                |
| `host:updateSettings`                                                     | 主辦方調整房間設定（分數上限、玩家模式、終點距離），僅 `WAITING` 階段允許，伺服器一律用 `normalizeRoomSettings()` 重新驗證 |
| `player:joinRoom`                                                         | 玩家加入；伺服器產生 `playerId` 與 `playerSessionToken`                                                                    |
| `player:resumeRoom`                                                       | 玩家以房號、玩家 ID 與 session token 恢復房間                                                                              |
| `player:step`                                                             | 玩家只送出 `{ foot, clientSeq }`；伺服器負責驗證、去重與限流                                                               |

**Server → Room**（廣播）：

| 事件                               | 時機                                               |
| ---------------------------------- | -------------------------------------------------- |
| `room:state`                       | 完整快照，結構性變化時送出（加入/離開/階段變化等） |
| `room:playerJoined` / `playerLeft` | 增量更新                                           |
| `room:phaseChanged`                | 遊戲階段推進，附帶本輪設定與時間資訊               |
| `ghost:stateChanged`               | 鬼的狀態真的轉換時送出（不逐幀送）                 |
| `room:playerStepped`               | 每次處理完一次踩腳後廣播                           |
| `room:playerBoostChanged`          | 隨機加速視窗開始/結束                              |
| `room:playerConnectionChanged`     | 斷線/重連/寬限期到期                               |
| `room:gameOver`                    | 結算，附上排名                                     |
| `room:closed`                      | 房間被回收關閉（例如長時間沒人連線）               |

建立房間或加入成功後，伺服器簽發的 session token 與房間資訊會保存於 `localStorage`。頁面重新整理或 Socket.IO 斷線重連時，客戶端會自動送出 resume；伺服器只接受目前 socket 綁定的 room/session 身分。房間狀態仍只存在單一 Node.js 程序的記憶體中，伺服器重啟後 token 與房間一併失效。

## 開發

需求：Node.js 22+（`type: "module"` + `node --test`）。

```bash
npm install        # 裝根目錄＋三個 workspace 的相依套件
npm run dev         # 同時起 server（:3001）與 client dev server（:5173），互相 proxy 好了
```

打開 `http://localhost:5173/host` 建立房間拿到房號/QR Code，另開分頁或用手機連到同一網段的 `http://<你的IP>:5173/join/<房號>` 加入。

```bash
npm run build       # 編譯 server（型別檢查）＋ build client（含 player.html／host.html 兩個入口）
npm test            # 跑 shared 與 server 的單元測試（node --test，用 tsx 直接跑 TS）
npm run lint        # ESLint（根目錄 flat config，涵蓋所有 workspace）
npm run format      # Prettier 自動修正
npm run format:check # Prettier 檢查（既有舊檔案還沒套用格式化，全庫跑會失敗，只需檢查有改到的檔案）
```

### 疑難排解：Windows 上 `npm run dev` 一啟動就掛掉

如果 `[client]` 那行噴出 `Cannot find native binding` / `Cannot find module '@rolldown/binding-win32-x64-msvc'`，是 npm optional dependencies 的已知 bug（[npm/cli#4828](https://github.com/npm/cli/issues/4828)）：Vite 8 內建的 rolldown 需要對應平台的 native binding，但 npm 有時候不會把它裝進去。解法是清掉 lockfile 跟所有 `node_modules` 再重裝一次：

```bash
rm -rf node_modules package-lock.json client/node_modules server/node_modules shared/node_modules
npm install
```

單一 workspace 也可以個別操作，例如 `npm run dev -w server`、`npm test -w shared`。

### 環境變數

| 變數              | 說明                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PORT`            | 伺服器監聽的 port，預設 `3001`                                                                                       |
| `GHOST_TEST_SEED` | 設定後鬼的亂數改用可重現的 xorshift32（而不是 `Math.random()`），讓 E2E 測試可以預期回頭時機。正式跑遊戲不要設這個。 |
| `CORS_ORIGIN`     | 選填；需要跨來源部署時指定允許的前端來源。未設定時以同源連線為主。                                                   |

### 端對端測試（Playwright）

```bash
npx playwright test
```

伺服器提供 `GET /healthz`，Render 使用 `/healthz` 作為健康檢查路徑。Socket.IO 預設先使用 polling，連線可用時自動升級 WebSocket；單次 ack 等待超過 5 秒會回報逾時。

`playwright.config.ts` 會自動幫你把 `server`（:3001）跟 `client`（:5173）都啟動起來再跑測試。如果環境預先裝好的 Chromium 版本跟 `@playwright/test` 預期抓的 revision 對不上（沙盒/CI 環境常見），設定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指到實際的可執行檔路徑即可跳過重新下載：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome npx playwright test
```

### 壓力測試

`scripts/load-test.mjs` 用 `socket.io-client` 模擬一個主辦方＋多名玩家同時連進同一個房間、持續踩腳，量測加入延遲、`player:step` 往返延遲、主控台收到廣播的延遲，以及鬼狀態事件的間隔（間接觀察伺服器 tick 迴圈有沒有被大量連線拖慢）。跑之前要先啟動伺服器：

```bash
npm run start -w server &
node scripts/load-test.mjs
LOAD_TEST_PLAYERS=150 LOAD_TEST_PLAY_MS=60000 node scripts/load-test.mjs   # 自訂人數/時長
```

實測：單一房間 100 位玩家（人數上限）同時連線＋連續踩腳，`player:step` 往返延遲中位數 <1ms；3 個房間共 300 位玩家同時運作，伺服器 CPU 峰值仍在 20% 以內。

## 加分玩法

- **最後衝刺**：距終點剩一小段距離時跳出提示＋畫面警示暈影。
- **隨機加速**：每位玩家每隔一段時間有機率進入短暫加速窗口，移動速度變 1.5 倍。
- **主辦方鏡頭模式**：鳥瞰（固定機位）／跟隨領先者／跟隨落後者／自由拖曳鏡頭，四種模式可即時切換。

## 部署

`render.yaml` 是 Render Blueprint 設定檔（`npm ci && npm run build` 建置、`npm run start -w server` 啟動、健康檢查走 `/healthz`），連上 Render 後可直接照這份設定建立服務。

## 尚未處理

- 自訂網域／HTTPS 憑證等正式上線的收尾設定。
- 資料持久化——目前房間狀態純記憶體，伺服器重啟就消失，也沒有活動紀錄/歷史排行榜。
- 正式 3D 美術資源：目前的娃娃/樹/玩家都是程式合成的 sprite 貼圖，不是 `.glb` 模型。

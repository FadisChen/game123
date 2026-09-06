# Graph Report - game123  (2026-09-06)

## Corpus Check
- 64 files · ~156,426 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 639 nodes · 1299 edges · 28 communities (23 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Networked Player Flow
- Server Runtime
- Room Rules and Config
- Host Control Panel
- Game Product Concepts
- Client Dependencies
- Browser Integration Tests
- Server Dependencies
- Player Avatar Rendering
- Host Scene Rendering
- Client TypeScript Config
- Networked Outcome Screens
- Root TypeScript Config
- 3D World Assets
- Shared Package Config
- Player Scene Rendering
- Shared Scene Effects
- Visual Design References
- Offline Game Flow
- Host Application
- Player Entry Flow
- Player Controls and Orientation
- Sound Effects Engine
- Server TypeScript Config
- Game UI State
- Player State Rules
- Outcome Effects
- Shared TypeScript Config

## God Nodes (most connected - your core abstractions)
1. `GameRoom` - 39 edges
2. `SocketClient` - 29 edges
3. `NetworkedGameController` - 25 edges
4. `HostScene` - 24 edges
5. `GameScene` - 23 edges
6. `HUD` - 21 edges
7. `HostConsolePanel` - 20 edges
8. `GhostAI` - 19 edges
9. `GameController` - 18 edges
10. `PlayerSummary` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Player Portrait Orientation Prompt` --conceptually_related_to--> `Player Mobile Client`  [INFERRED]
  artifacts/ui-previews/player-portrait.png → README.md
- `Host Bird's-Eye Console Preview` --conceptually_related_to--> `Host Camera Modes`  [INFERRED]
  artifacts/ui-previews/host.png → README.md
- `Player First-Person View` --conceptually_related_to--> `123 Wooden Man Multiplayer Game`  [INFERRED]
  artifacts/ui-previews/player.png → README.md
- `Player Mobile Landscape View` --conceptually_related_to--> `123 Wooden Man Multiplayer Game`  [INFERRED]
  artifacts/ui-previews/player-mobile-landscape.png → README.md
- `Player First-Person View` --conceptually_related_to--> `Player Mobile Client`  [INFERRED]
  artifacts/ui-previews/player.png → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Authoritative Multiplayer Game Flow** — readme_123_wooden_man_game, readme_player_mobile_client, readme_host_control_console, readme_server_authoritative_judgment [EXTRACTED 1.00]
- **Shared Client-Server Logic Surface** — readme_shared_logic_and_types, readme_config_single_source, readme_player_authoritative_rules, readme_ghost_authoritative_ai, readme_ranking_rules, readme_socketio_protocol [EXTRACTED 1.00]
- **Multi-View Game Experience** — asserts_chatgpt_image_2026_9_5_07_14_21_composite_game_ui, asserts_chatgpt_image_2026_9_5_07_14_21_first_person_player_view, asserts_chatgpt_image_2026_9_5_07_14_21_host_overview_view, asserts_chatgpt_image_2026_9_5_07_14_21_game_status_hud, asserts_chatgpt_image_2026_9_5_07_14_21_camera_control_panel [EXTRACTED 1.00]
- **Game State HUD Fields** — asserts_chatgpt_image_2026_9_5_07_14_21_game_status_hud, asserts_chatgpt_image_2026_9_5_07_14_21_green_light_phase, asserts_chatgpt_image_2026_9_5_07_14_21_countdown_timer_00_08, asserts_chatgpt_image_2026_9_5_07_14_21_active_player_count_23_32 [EXTRACTED 1.00]
- **Arena Entities** — asserts_chatgpt_image_2026_9_5_07_14_21_outdoor_game_arena, asserts_chatgpt_image_2026_9_5_07_14_21_doll_referee, asserts_chatgpt_image_2026_9_5_07_14_21_numbered_player_avatars [EXTRACTED 1.00]

## Communities (28 total, 5 thin omitted)

### Community 0 - "Networked Player Flow"
Cohesion: 0.06
Nodes (29): NetworkedGameController, ClockSync, getPersistentHostId(), getPersistentPlayerId(), readOrCreatePersistentId(), SocketClient, Foot, GhostVisualState (+21 more)

### Community 1 - "Server Runtime"
Cohesion: 0.07
Nodes (28): socket.io, app, CLIENT_DIST, __dirname, httpServer, io, PORT, roomManager (+20 more)

### Community 2 - "Room Rules and Config"
Cohesion: 0.06
Nodes (31): RoomEvent, noFakeTurnRng(), scriptedRng(), toStepResultMsg(), DEFAULT_ROOM_SETTINGS, DIFFICULTY_OPTIONS, DIFFICULTY_PROFILES, DifficultyProfile (+23 more)

### Community 3 - "Host Control Panel"
Cohesion: 0.07
Nodes (16): CAMERA_MODE_OPTIONS, DIFFICULTY_LABEL, HostConsolePanel, HostConsolePanelCallbacks, PHASE_LABEL, HostCameraMode, HUD, ToastVariant (+8 more)

### Community 4 - "Game Product Concepts"
Cohesion: 0.08
Nodes (41): Host Bird's-Eye Console Preview, Player First-Person View, Player Mobile Landscape View, Player Portrait Orientation Prompt, Host HTML Entry Point, Player HTML Entry Point, Purple Lightning Favicon, 123 Wooden Man Multiplayer Game (+33 more)

### Community 5 - "Client Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, qrcode, shared, socket.io-client, three, devDependencies, @types/qrcode, @types/three (+26 more)

### Community 6 - "Browser Integration Tests"
Cohesion: 0.08
Nodes (16): CAMERA_MODES, distance(), labelPosition(), pollLabelDistanceFrom(), devDependencies, concurrently, @playwright/test, name (+8 more)

### Community 7 - "Server Dependencies"
Cohesion: 0.08
Nodes (24): express, @types/express, dependencies, express, shared, socket.io, devDependencies, tsx (+16 more)

### Community 8 - "Player Avatar Rendering"
Cohesion: 0.14
Nodes (11): ALIVE_COLOR, AvatarState, DEAD_COLOR, drawNameTexture(), easeOutCubic(), OFFLINE_COLOR, PlayerAvatarOptions, PlayerAvatars (+3 more)

### Community 10 - "Client TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 11 - "Networked Outcome Screens"
Cohesion: 0.14
Nodes (6): GameOutcome, GameOverScreen, OUTCOME_COPY, WaitingScreen, FINAL_SPRINT_REMAINING_M, StepResultMsg

### Community 12 - "Root TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, erasableSyntaxOnly, forceConsistentCasingInFileNames, lib, module, moduleDetection, moduleResolution, noFallthroughCasesInSwitch (+7 more)

### Community 13 - "3D World Assets"
Cohesion: 0.33
Nodes (12): createCharacter(), createPlayerGeometry(), part(), sphere(), buildFieldEnvironment(), buildHouse(), buildTree(), FIELD_HALF_WIDTH_M (+4 more)

### Community 14 - "Shared Package Config"
Cohesion: 0.13
Nodes (14): devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node, typescript (+6 more)

### Community 15 - "Player Scene Rendering"
Cohesion: 0.19
Nodes (4): lightScene(), playerWorldZ(), easeOutCubic(), GameScene

### Community 16 - "Shared Scene Effects"
Cohesion: 0.21
Nodes (8): GhostVisual, ActiveEffect, BIRDSEYE_LOOK_AT, BIRDSEYE_POSITION, HostAvatarInput, three, COLORS, FINISH_DISTANCE_M

### Community 17 - "Visual Design References"
Cohesion: 0.22
Nodes (13): Active Player Count (23/32), Camera Control Panel, Center Crosshair, Composite Player and Host Game UI, Countdown Timer (00:08), Doll Referee, First-Person Player View, Game Status HUD (+5 more)

### Community 20 - "Player Entry Flow"
Cohesion: 0.21
Nodes (3): app, JoinScreen, JoinErrorCode

### Community 21 - "Player Controls and Orientation"
Cohesion: 0.23
Nodes (7): buildFootButton(), installLandscapeGuard(), isLandscape(), requestLandscape(), RULES, TeachingScreen, FOOT_BUTTON_LOCKOUT_MS

### Community 23 - "Server TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, types, extends, include, ../tsconfig.base.json

### Community 24 - "Game UI State"
Cohesion: 0.29
Nodes (5): sfx, SfxName, GameState, COUNTDOWN_SECONDS, STEP_TWEEN_MS

### Community 25 - "Player State Rules"
Cohesion: 0.29
Nodes (3): ServerPlayerState, LookingCheck, Player

### Community 27 - "Shared TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../tsconfig.base.json

## Knowledge Gaps
- **157 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 233 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameRoom` connect `Server Runtime` to `Room Rules and Config`, `Host Control Panel`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `socket.io` connect `Server Runtime` to `Server Dependencies`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `HostScene` connect `Host Scene Rendering` to `Networked Player Flow`, `Player Avatar Rendering`, `Shared Scene Effects`, `Host Application`, `Outcome Effects`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _157 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Networked Player Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.0639269406392694 - nodes in this community are weakly interconnected._
- **Should `Server Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.06540825285338016 - nodes in this community are weakly interconnected._
- **Should `Room Rules and Config` be split into smaller, more focused modules?**
  _Cohesion score 0.06291591046581972 - nodes in this community are weakly interconnected._
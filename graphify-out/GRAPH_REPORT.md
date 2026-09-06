# Graph Report - game123  (2026-09-06)

## Corpus Check
- 94 files · ~396,225 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 925 nodes · 1820 edges · 58 communities (42 shown, 15 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 85 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Networked Game Controller
- Audio Playback
- Verification Workflows
- Client Dependencies
- Socket Client
- Server Game Room
- Room Rules and Tests
- Host Gameplay Views
- Player Avatars
- Server Dependencies
- Deployment Architecture
- Ghost AI
- Host Scene Rendering
- Networked Client Sync
- 3D World Assets
- Player Socket Handlers
- Socket Client Events
- Host Controller
- Client TypeScript Config
- Host Console UI
- Gameplay UI Previews
- Game Scene Rendering
- Server Socket Layer
- Base TypeScript Config
- Gameplay Design Concepts
- UI Preview Assets
- Networked Gameplay UI
- Host Player Game UI
- Rate Limiting Tests
- Root Tooling Config
- Server Runtime
- Formal UI Preview
- Host Integration and Clock
- Game Tutorial Concepts
- E2E Gameplay Tests
- Ranking Rules
- Host Camera E2E Tests
- Tooling Dependencies
- Server TypeScript Config
- Join Screen UI
- Room Manager
- Ghost Replica AI
- Offline Gameplay Previews
- Outcome Effects
- Waiting Screen UI
- Workspace Scripts
- Player State Rules
- Shared TypeScript Config
- Motion Tutorial
- Motion Gameplay Preview
- Audio E2E Tests
- Reconnection State
- Player Resume Protocol
- HTML Entry Points
- Player View Previews
- Host Preview
- Portrait Orientation

## God Nodes (most connected - your core abstractions)
1. `GameRoom` - 43 edges
2. `SocketClient` - 40 edges
3. `NetworkedGameController` - 31 edges
4. `HostScene` - 28 edges
5. `HostConsolePanel` - 26 edges
6. `registerHostHandlers()` - 24 edges
7. `GameScene` - 23 edges
8. `HostController` - 22 edges
9. `Foot` - 22 edges
10. `GhostAI` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Deterministic Ghost Test Seed` --semantically_similar_to--> `GHOST_TEST_SEED`  [INFERRED] [semantically similar]
  CLAUDE.md → .claude/skills/verify/SKILL.md
- `Render PORT Injection` --semantically_similar_to--> `PORT Environment Variable`  [INFERRED] [semantically similar]
  佈署計畫.md → CLAUDE.md
- `GameController` --references--> `GhostAI`  [EXTRACTED]
  client/src/game/GameController.ts → shared/src/GhostAI.ts
- `GameController` --references--> `GhostState`  [EXTRACTED]
  client/src/game/GameController.ts → shared/src/GhostAI.ts
- `GameController` --references--> `Player`  [EXTRACTED]
  client/src/game/GameController.ts → shared/src/Player.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Repository Verification Pipeline** — _claude_skills_verify_skill_unit_tests, _claude_skills_verify_skill_type_check_build, _claude_skills_verify_skill_playwright_e2e, _claude_skills_verify_skill_lint [EXTRACTED 1.00]
- **Unified Render Deployment Stack** — _____unified_render_architecture, _____client_dist_static, _____server_express_socketio [INFERRED 0.85]
- **Game Scene Composition** — artifacts_ui_previews_formal_player_third_person_player_avatar, artifacts_ui_previews_formal_player_leafless_tree, artifacts_ui_previews_formal_player_rural_huts, artifacts_ui_previews_formal_player_pink_masked_npcs [INFERRED 0.85]
- **Gameplay HUD and Controls** — artifacts_ui_previews_formal_player_player_count_hud, artifacts_ui_previews_formal_player_heart_status_indicator, artifacts_ui_previews_formal_player_leg_movement_controls, artifacts_ui_previews_formal_player_finish_distance_indicator, artifacts_ui_previews_formal_player_movement_instruction_overlay [INFERRED 0.95]
- **Host Game Session Interface** — artifacts_ui_previews_host_updated_ui_preview, artifacts_ui_previews_host_updated_host_control_panel, artifacts_ui_previews_host_updated_game_status, artifacts_ui_previews_host_updated_game_settings, artifacts_ui_previews_host_updated_camera_control [INFERRED 0.85]
- **Arena Visual Scene** — artifacts_ui_previews_host_updated_game_arena, artifacts_ui_previews_host_updated_central_tree_character, artifacts_ui_previews_host_updated_player_avatar, artifacts_ui_previews_host_updated_wheat_field, artifacts_ui_previews_host_updated_village_houses, artifacts_ui_previews_host_updated_tree_line [INFERRED 0.85]
- **Motion Mode Instruction Screen** — artifacts_ui_previews_motion_player_portrait_image, artifacts_ui_previews_motion_player_portrait_motion_mode, artifacts_ui_previews_motion_player_portrait_music_synchronized_movement, artifacts_ui_previews_motion_player_portrait_vertical_motion_instruction [EXTRACTED 1.00]
- **Motion Mode Guidance Elements** — artifacts_ui_previews_motion_player_motion_player_preview, artifacts_ui_previews_motion_player_motion_sensing_mode, artifacts_ui_previews_motion_player_live_music_movement, artifacts_ui_previews_motion_player_one_step_per_vertical_motion [EXTRACTED 1.00]
- **Mobile Obstacle-Race Interface** — artifacts_ui_previews_offline_player_mobile_mobile_game_ui, artifacts_ui_previews_offline_player_mobile_third_person_race_scene, artifacts_ui_previews_offline_player_mobile_survivors_hud, artifacts_ui_previews_offline_player_mobile_start_finish_progress_hud, artifacts_ui_previews_offline_player_mobile_left_direction_control, artifacts_ui_previews_offline_player_mobile_right_direction_control [INFERRED 0.85]
- **Wooden Man Gameplay Preview** — artifacts_ui_previews_offline_player_wooden_man_game, artifacts_ui_previews_offline_player_player_avatars, artifacts_ui_previews_offline_player_giant_doll, artifacts_ui_previews_offline_player_movement_controls, artifacts_ui_previews_offline_player_alive_player_counter [INFERRED 0.85]
- **Tutorial Rules for Red Light, Green Light** — artifacts_ui_previews_offline_teaching_game_tutorial, artifacts_ui_previews_offline_teaching_movement_controls, artifacts_ui_previews_offline_teaching_music_signal, artifacts_ui_previews_offline_teaching_movement_penalty, artifacts_ui_previews_offline_teaching_score_elimination, artifacts_ui_previews_offline_teaching_race_victory [EXTRACTED 1.00]
- **Multiview Gameplay Interface** — asserts_chatgpt_2_image, asserts_chatgpt_2_first_person_view, asserts_chatgpt_2_overhead_view, asserts_chatgpt_2_minimap [EXTRACTED 1.00]
- **Multi-View Game Experience** — asserts_chatgpt_image_2026_9_5_07_14_21_composite_game_ui, asserts_chatgpt_image_2026_9_5_07_14_21_first_person_player_view, asserts_chatgpt_image_2026_9_5_07_14_21_host_overview_view, asserts_chatgpt_image_2026_9_5_07_14_21_game_status_hud, asserts_chatgpt_image_2026_9_5_07_14_21_camera_control_panel [EXTRACTED 1.00]
- **Game State HUD Fields** — asserts_chatgpt_image_2026_9_5_07_14_21_game_status_hud, asserts_chatgpt_image_2026_9_5_07_14_21_green_light_phase, asserts_chatgpt_image_2026_9_5_07_14_21_countdown_timer_00_08, asserts_chatgpt_image_2026_9_5_07_14_21_active_player_count_23_32 [EXTRACTED 1.00]
- **Arena Entities** — asserts_chatgpt_image_2026_9_5_07_14_21_outdoor_game_arena, asserts_chatgpt_image_2026_9_5_07_14_21_doll_referee, asserts_chatgpt_image_2026_9_5_07_14_21_numbered_player_avatars [EXTRACTED 1.00]

## Communities (58 total, 15 thin omitted)

### Community 0 - "Networked Game Controller"
Cohesion: 0.05
Nodes (25): GameController, GameState, DeviceMotionEventWithPermission, isSecureMotionContext(), MotionInput, oppositeFoot(), app, clearPlayerSession() (+17 more)

### Community 1 - "Audio Playback"
Cohesion: 0.07
Nodes (9): MusicPlayer, sfx, SfxEngine, SfxName, HostConsolePanel, GameStatus, GhostState, GhostVisualState (+1 more)

### Community 2 - "Verification Workflows"
Cohesion: 0.05
Nodes (44): Verify Skill, Prettier Format Check, Gameplay or Socket Change, GHOST_TEST_SEED, npm Run Lint, Playwright End-to-End Tests, npm Run Build Type Check, npm Test Unit Tests (+36 more)

### Community 3 - "Client Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, qrcode, shared, socket.io-client, three, devDependencies, @types/qrcode, @types/three (+26 more)

### Community 4 - "Socket Client"
Cohesion: 0.09
Nodes (24): getStoredHostSession(), getStoredPlayerSession(), HostSession, isNonEmptyString(), PlayerSession, readJson(), saveHostSession(), savePlayerSession() (+16 more)

### Community 5 - "Server Game Room"
Cohesion: 0.10
Nodes (11): createSessionToken(), GameRoom, roomJustStartedPlaying(), roomSettledIntoPlaying(), toStepResultMsg(), registerHostHandlers(), RoomSettings, GameOverReason (+3 more)

### Community 6 - "Room Rules and Tests"
Cohesion: 0.13
Nodes (22): RoomEvent, ServerPlayerState, noFakeTurnRng(), scriptedRng(), DEFAULT_ROOM_SETTINGS, MAX_GAME_DURATION_MS, MAX_PLAYERS_PER_ROOM, MAX_STEP_EVENTS_PER_WINDOW (+14 more)

### Community 7 - "Host Gameplay Views"
Cohesion: 0.10
Nodes (27): Bird's-Eye Camera, Camera Control, Central Tree-Like Character, Configured Distance: 50.0 m, Free Camera, 3D Game Arena, Game Distance, Game Settings (+19 more)

### Community 8 - "Player Avatars"
Cohesion: 0.14
Nodes (15): FIELD_LENGTH, ALIVE_COLOR, AvatarState, COLLAPSE_DURATION_MS, COLLAPSE_ROLL_RAD, DEAD_COLOR, drawNameTexture(), easeOutCubic() (+7 more)

### Community 9 - "Server Dependencies"
Cohesion: 0.08
Nodes (24): express, @types/express, dependencies, express, shared, socket.io, devDependencies, tsx (+16 more)

### Community 10 - "Deployment Architecture"
Cohesion: 0.09
Nodes (24): Deployment Build Command, client/dist Static Files, Cloud Run, Deployment Backlog, 60 Mobile Players Deployment Goal, Deployment Plan, Mobile QR End-to-End Smoke Check, Fly.io (+16 more)

### Community 11 - "Ghost AI"
Cohesion: 0.14
Nodes (8): GHOST_TURN_DURATION_MS, MUSIC_LOOKING_MAX_MS, MUSIC_LOOKING_MIN_MS, musicPhaseDurationMs(), musicPlaybackRate(), computeFacingAmount(), GhostAI, randomLookingDuration()

### Community 14 - "3D World Assets"
Cohesion: 0.23
Nodes (15): createCharacter(), createPlayerGeometry(), part(), sphere(), buildFieldEnvironment(), buildHouse(), buildTree(), FIELD_HALF_WIDTH_M (+7 more)

### Community 15 - "Player Socket Handlers"
Cohesion: 0.28
Nodes (17): createPlayerId(), registerPlayerHandlers(), getAuthenticatedPlayerSession(), setPlayerSession(), hasExactKeys(), isEmptyPayload(), isHostCreateRoomPayload(), isHostResumeRoomPayload() (+9 more)

### Community 16 - "Socket Client Events"
Cohesion: 0.22
Nodes (4): SocketClient, ConnectionState, HostRoomActionAck, HostRoomActionPayload

### Community 17 - "Host Controller"
Cohesion: 0.27
Nodes (3): HostController, clearHostSession(), RoomStateSnapshot

### Community 18 - "Client TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 19 - "Host Console UI"
Cohesion: 0.14
Nodes (13): CAMERA_MODE_OPTIONS, HostConsolePanelCallbacks, PHASE_LABEL, BIRDSEYE_LOOK_AT, BIRDSEYE_POSITION, easeInOutCubic(), HostAvatarInput, HostCameraMode (+5 more)

### Community 20 - "Gameplay UI Previews"
Cohesion: 0.12
Nodes (16): Enclosed Game Arena, First-Person Gameplay View, Giant Game Doll, Green Tracksuit Players, Split-Screen Gameplay Screenshot, Masked Guards, Gameplay Minimap, Overhead Gameplay View (+8 more)

### Community 22 - "Server Socket Layer"
Cohesion: 0.28
Nodes (11): socket.io, applyRoomEvents(), broadcastGhostState(), broadcastSnapshot(), registerDisconnectHandler(), withHostRoom(), getAuthenticatedHostRoom(), setHostSession() (+3 more)

### Community 23 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, erasableSyntaxOnly, forceConsistentCasingInFileNames, lib, module, moduleDetection, moduleResolution, noFallthroughCasesInSwitch (+7 more)

### Community 24 - "Gameplay Design Concepts"
Cohesion: 0.22
Nodes (15): Alternating Direction Input, 50-Meter Distance Indicator, Giant Tree and Doll Landmark, Heart Life Indicator HUD, Offline Player Mobile UI Preview, Left Direction Control, Mobile Game Interface, Offline Player Mode (+7 more)

### Community 25 - "UI Preview Assets"
Cohesion: 0.13
Nodes (14): devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node, typescript (+6 more)

### Community 26 - "Networked Gameplay UI"
Cohesion: 0.19
Nodes (8): ActiveEffect, ToastVariant, CAUGHT_TOAST_MS, COLORS, FINISH_DISTANCE_M, INITIAL_SCORE, STEP_DISTANCE_M, StepResult

### Community 27 - "Host Player Game UI"
Cohesion: 0.22
Nodes (13): Active Player Count (23/32), Camera Control Panel, Center Crosshair, Composite Player and Host Game UI, Countdown Timer (00:08), Doll Referee, First-Person Player View, Game Status HUD (+5 more)

### Community 28 - "Rate Limiting Tests"
Cohesion: 0.18
Nodes (4): RateLimiter, WindowState, FakeSocket, Handler

### Community 29 - "Root Tooling Config"
Cohesion: 0.21
Nodes (10): name, private, workspaces, concurrently, eslint, eslint-config-prettier, @eslint/js, globals (+2 more)

### Community 30 - "Server Runtime"
Cohesion: 0.17
Nodes (10): app, CLIENT_DIST, createRoomLimiter, __dirname, httpServer, io, joinRoomLimiter, PORT (+2 more)

### Community 31 - "Formal UI Preview"
Cohesion: 0.29
Nodes (11): Finish Distance Indicator, Heart Status Indicator, Formal Player Game UI Preview, Leafless Tree Landmark, Left and Right Leg Movement Controls, Movement Instruction Overlay, Pink Masked NPCs, Player Count HUD (+3 more)

### Community 32 - "Host Integration and Clock"
Cohesion: 0.20
Nodes (4): app, ClockSync, RoomPlayerBoostChangedPayload, RoomPlayerSteppedPayload

### Community 33 - "Game Tutorial Concepts"
Cohesion: 0.27
Nodes (10): 遊戲教學 / Game Tutorial, Giant Doll Referee, Offline Teaching Game UI Preview, Mouse and Keyboard Movement Controls, Movement Detection and Point Penalty, Music-Based Movement Signal, Numbered Player Characters, Finish-Line Victory Condition (+2 more)

### Community 35 - "Ranking Rules"
Cohesion: 0.28
Nodes (4): computeRanking(), RankedPlayer, RankingInput, RankingOutcome

### Community 36 - "Host Camera E2E Tests"
Cohesion: 0.28
Nodes (4): CAMERA_MODES, distance(), labelPosition(), pollLabelDistanceFrom()

### Community 37 - "Tooling Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently, eslint, eslint-config-prettier, @eslint/js, globals, @playwright/test, prettier (+1 more)

### Community 38 - "Server TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, types, extends, include, ../tsconfig.base.json

### Community 42 - "Offline Gameplay Previews"
Cohesion: 0.43
Nodes (7): Alive Player Counter, Outdoor Game Arena, Giant Game Doll, Offline Player UI Preview, Left and Right Foot Controls, Numbered Player Avatars, 1-2-3 Wooden Man Game

### Community 45 - "Workspace Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, format:check, lint, test

### Community 47 - "Shared TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../tsconfig.base.json

### Community 48 - "Motion Tutorial"
Cohesion: 0.40
Nodes (6): Motion Player Portrait UI Preview, Motion Mode, Music-Synchronized Movement, One-Step Advance Mechanism, Organizer Screen, Up-and-Down Motion Instruction

### Community 49 - "Motion Gameplay Preview"
Cohesion: 0.60
Nodes (5): Live Music-Guided Movement, Motion Player Sensing Mode Preview, 感應模式 (Motion Sensing Mode), One-Step Advance Per Vertical Motion, Organizer Screen

### Community 51 - "Reconnection State"
Cohesion: 0.50
Nodes (4): Browser localStorage, Persistent Player and Host Reconnection, RECONNECT_GRACE_MS, Socket.IO socket.id

### Community 53 - "HTML Entry Points"
Cohesion: 0.67
Nodes (3): Host HTML Entry Point, Player HTML Entry Point, Purple Lightning Favicon

## Ambiguous Edges - Review These
- `Offline Player Mobile UI Preview` → `Red-Light/Green-Light Style Gameplay`  [AMBIGUOUS]
  artifacts/ui-previews/offline-player-mobile.png · relation: references

## Knowledge Gaps
- **248 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+243 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 348 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Offline Player Mobile UI Preview` and `Red-Light/Green-Light Style Gameplay`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Shared Workspace` connect `Verification Workflows` to `Room Rules and Tests`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `GameRoom` connect `Server Game Room` to `Audio Playback`, `Ranking Rules`, `Room Rules and Tests`, `Room Manager`, `Ghost AI`, `Server Socket Layer`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `socket.io` connect `Server Socket Layer` to `Server Dependencies`, `Rate Limiting Tests`, `Server Runtime`, `Player Socket Handlers`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _248 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Networked Game Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Audio Playback` be split into smaller, more focused modules?**
  _Cohesion score 0.07400555041628122 - nodes in this community are weakly interconnected._
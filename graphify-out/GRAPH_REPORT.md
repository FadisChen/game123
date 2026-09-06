# Graph Report - game123  (2026-09-06)

## Corpus Check
- 87 files · ~392,269 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 904 nodes · 1646 edges · 62 communities (55 shown, 6 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Networked Player Client
- Shared Game Domain
- Server Runtime
- Host Scene Runtime
- Client Dependencies
- Host Console UI
- Offline Player Controller
- Client Support Services
- Player Avatars
- Host UI Preview
- Server Dependencies
- Audio Playback
- 3D World Assets
- Client TypeScript Config
- Player Entry Flow
- Composite Gameplay Preview
- Base TypeScript Config
- Offline Mobile Preview
- Game Scene Renderer
- Shared Package Config
- Socket Event Protocol
- Composite UI Preview
- Motion Input
- Player Controls
- ESLint Configuration
- Formal Player Preview
- Networked Join Flow
- Tutorial Gameplay
- Deployment Architecture
- Deployment Planning
- Render Service Config
- Shared Game Concepts
- Host Camera Tests
- E2E Motion Tests
- Root Dev Tools
- Server TypeScript Config
- Verification Pipeline
- Host Scene Integration
- Offline Gameplay Preview
- Game Rules
- Project Documentation
- Reconnection Identity
- Host Effects
- Root NPM Scripts
- Shared TypeScript Config
- Motion Tutorial Preview
- Workspace Structure
- Authoritative Gameplay
- Audio Gameplay Rhythm
- Deterministic E2E Testing
- Motion Sensing Preview
- Server Tick Lifecycle
- Server Socket Layer
- Audio E2E Tests
- Server State Broadcast
- Same-Origin Deployment
- HTML Entry Points
- Player View Preview
- Offline Game Mode
- Portrait Orientation
- Ranking Rules

## God Nodes (most connected - your core abstractions)
1. `GameRoom` - 38 edges
2. `NetworkedGameController` - 29 edges
3. `SocketClient` - 28 edges
4. `HostScene` - 25 edges
5. `GameScene` - 23 edges
6. `Foot` - 22 edges
7. `HostConsolePanel` - 21 edges
8. `GhostAI` - 20 edges
9. `PlayerSummary` - 20 edges
10. `GameController` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Host Bird's-Eye Console Preview` --conceptually_related_to--> `HostScene`  [INFERRED]
  artifacts/ui-previews/host.png → README.md
- `Single Global Tick Loop` --semantically_similar_to--> `Server Entry and Global Tick`  [INFERRED] [semantically similar]
  CLAUDE.md → README.md
- `Host Bird's-Eye Console Preview` --conceptually_related_to--> `HostConsolePanel`  [INFERRED]
  artifacts/ui-previews/host.png → README.md
- `Deterministic Ghost Test Seed` --semantically_similar_to--> `GHOST_TEST_SEED`  [INFERRED] [semantically similar]
  CLAUDE.md → .claude/skills/verify/SKILL.md
- `Shared Socket Protocol` --semantically_similar_to--> `Shared Protocol Types`  [INFERRED] [semantically similar]
  CLAUDE.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-View Game Experience** — asserts_chatgpt_image_2026_9_5_07_14_21_composite_game_ui, asserts_chatgpt_image_2026_9_5_07_14_21_first_person_player_view, asserts_chatgpt_image_2026_9_5_07_14_21_host_overview_view, asserts_chatgpt_image_2026_9_5_07_14_21_game_status_hud, asserts_chatgpt_image_2026_9_5_07_14_21_camera_control_panel [EXTRACTED 1.00]
- **Game State HUD Fields** — asserts_chatgpt_image_2026_9_5_07_14_21_game_status_hud, asserts_chatgpt_image_2026_9_5_07_14_21_green_light_phase, asserts_chatgpt_image_2026_9_5_07_14_21_countdown_timer_00_08, asserts_chatgpt_image_2026_9_5_07_14_21_active_player_count_23_32 [EXTRACTED 1.00]
- **Arena Entities** — asserts_chatgpt_image_2026_9_5_07_14_21_outdoor_game_arena, asserts_chatgpt_image_2026_9_5_07_14_21_doll_referee, asserts_chatgpt_image_2026_9_5_07_14_21_numbered_player_avatars [EXTRACTED 1.00]
- **Server-Authoritative Game Flow** — claude_server_authoritative_judging, readme_server_judgment, readme_client_intent, claude_game_room [INFERRED 0.85]
- **Unified Render Deployment Stack** — _____unified_render_architecture, render_game123_service, _____client_dist_static, _____server_express_socketio [INFERRED 0.85]
- **Repository Verification Pipeline** — _claude_skills_verify_skill_unit_tests, _claude_skills_verify_skill_type_check_build, _claude_skills_verify_skill_playwright_e2e, _claude_skills_verify_skill_lint [EXTRACTED 1.00]
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

## Communities (62 total, 6 thin omitted)

### Community 0 - "Networked Player Client"
Cohesion: 0.06
Nodes (25): NetworkedGameController, getPersistentHostId(), getPersistentPlayerId(), readOrCreatePersistentId(), SocketClient, WaitingScreen, HostCreateRoomAck, HostCreateRoomPayload (+17 more)

### Community 1 - "Shared Game Domain"
Cohesion: 0.06
Nodes (33): RoomEvent, noFakeTurnRng(), scriptedRng(), CAUGHT_TOAST_MS, COLORS, DEFAULT_ROOM_SETTINGS, FOOT_BUTTON_LOCKOUT_MS, GHOST_TURN_DURATION_MS (+25 more)

### Community 2 - "Server Runtime"
Cohesion: 0.07
Nodes (28): socket.io, app, CLIENT_DIST, __dirname, httpServer, io, PORT, roomManager (+20 more)

### Community 3 - "Host Scene Runtime"
Cohesion: 0.09
Nodes (4): OutcomeEffects, HostController, HostScene, app

### Community 4 - "Client Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, qrcode, shared, socket.io-client, three, devDependencies, @types/qrcode, @types/three (+26 more)

### Community 5 - "Host Console UI"
Cohesion: 0.10
Nodes (15): CAMERA_MODE_OPTIONS, HostConsolePanel, HostConsolePanelCallbacks, PHASE_LABEL, HostCameraMode, GameStatus, PLAYER_MODE_OPTIONS, RoomSettings (+7 more)

### Community 6 - "Offline Player Controller"
Cohesion: 0.09
Nodes (6): GameController, GameOverScreen, HUD, ServerPlayerState, LookingCheck, Player

### Community 7 - "Client Support Services"
Cohesion: 0.14
Nodes (14): sfx, SfxName, GameState, DeviceMotionEventWithPermission, ClockSync, GameOutcome, OUTCOME_COPY, ToastVariant (+6 more)

### Community 8 - "Player Avatars"
Cohesion: 0.13
Nodes (15): ALIVE_COLOR, AvatarState, COLLAPSE_DURATION_MS, COLLAPSE_ROLL_RAD, DEAD_COLOR, drawNameTexture(), easeOutCubic(), OFFLINE_COLOR (+7 more)

### Community 9 - "Host UI Preview"
Cohesion: 0.10
Nodes (27): Bird's-Eye Camera, Camera Control, Central Tree-Like Character, Configured Distance: 50.0 m, Free Camera, 3D Game Arena, Game Distance, Game Settings (+19 more)

### Community 10 - "Server Dependencies"
Cohesion: 0.08
Nodes (24): express, @types/express, dependencies, express, shared, socket.io, devDependencies, tsx (+16 more)

### Community 11 - "Audio Playback"
Cohesion: 0.19
Nodes (3): MusicPlayer, SfxEngine, GhostVisualState

### Community 12 - "3D World Assets"
Cohesion: 0.25
Nodes (15): createCharacter(), createPlayerGeometry(), part(), sphere(), buildFieldEnvironment(), buildHouse(), buildTree(), FIELD_HALF_WIDTH_M (+7 more)

### Community 13 - "Client TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 14 - "Player Entry Flow"
Cohesion: 0.18
Nodes (5): app, JoinScreen, installLandscapeGuard(), isLandscape(), requestLandscape()

### Community 15 - "Composite Gameplay Preview"
Cohesion: 0.12
Nodes (16): Enclosed Game Arena, First-Person Gameplay View, Giant Game Doll, Green Tracksuit Players, Split-Screen Gameplay Screenshot, Masked Guards, Gameplay Minimap, Overhead Gameplay View (+8 more)

### Community 16 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, erasableSyntaxOnly, forceConsistentCasingInFileNames, lib, module, moduleDetection, moduleResolution, noFallthroughCasesInSwitch (+7 more)

### Community 17 - "Offline Mobile Preview"
Cohesion: 0.22
Nodes (15): Alternating Direction Input, 50-Meter Distance Indicator, Giant Tree and Doll Landmark, Heart Life Indicator HUD, Offline Player Mobile UI Preview, Left Direction Control, Mobile Game Interface, Offline Player Mode (+7 more)

### Community 18 - "Game Scene Renderer"
Cohesion: 0.17
Nodes (3): lightScene(), GhostVisual, GameScene

### Community 19 - "Shared Package Config"
Cohesion: 0.13
Nodes (14): devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node, typescript (+6 more)

### Community 20 - "Socket Event Protocol"
Cohesion: 0.15
Nodes (14): ghost:stateChanged, host:createRoom, Host Game Control Events, Socket.IO Load Test, player:joinRoom, player:step, room:gameOver, room:phaseChanged (+6 more)

### Community 21 - "Composite UI Preview"
Cohesion: 0.22
Nodes (13): Active Player Count (23/32), Camera Control Panel, Center Crosshair, Composite Player and Host Game UI, Countdown Timer (00:08), Doll Referee, First-Person Player View, Game Status HUD (+5 more)

### Community 22 - "Motion Input"
Cohesion: 0.23
Nodes (3): isSecureMotionContext(), MotionInput, oppositeFoot()

### Community 23 - "Player Controls"
Cohesion: 0.29
Nodes (3): buildFootButton(), Controls, Foot

### Community 24 - "ESLint Configuration"
Cohesion: 0.21
Nodes (10): name, private, workspaces, concurrently, eslint, eslint-config-prettier, @eslint/js, globals (+2 more)

### Community 25 - "Formal Player Preview"
Cohesion: 0.29
Nodes (11): Finish Distance Indicator, Heart Status Indicator, Formal Player Game UI Preview, Leafless Tree Landmark, Left and Right Leg Movement Controls, Movement Instruction Overlay, Pink Masked NPCs, Player Count HUD (+3 more)

### Community 26 - "Networked Join Flow"
Cohesion: 0.20
Nodes (10): Mobile QR End-to-End Smoke Check, Client Intent-Only Input, Button Input Fallback, JoinScreen, Player Entry Point, Motion and Footstep Controls, MotionInput, NetworkedGameController (+2 more)

### Community 27 - "Tutorial Gameplay"
Cohesion: 0.27
Nodes (10): 遊戲教學 / Game Tutorial, Giant Doll Referee, Offline Teaching Game UI Preview, Mouse and Keyboard Movement Controls, Movement Detection and Point Penalty, Music-Based Movement Signal, Numbered Player Characters, Finish-Line Victory Condition (+2 more)

### Community 28 - "Deployment Architecture"
Cohesion: 0.22
Nodes (9): client/dist Static Files, Cloud Run, Fly.io, GitHub Pages and Render Split Architecture, Google Free Hosting Alternative, Render.com, Render Free Plan Deployment, Express and Socket.IO Server (+1 more)

### Community 29 - "Deployment Planning"
Cohesion: 0.22
Nodes (9): Deployment Backlog, 60 Mobile Players Deployment Goal, Deployment Plan, FadisChen/game123 GitHub Repository, Deployment Load Test, Render PORT Injection, Render Dashboard, PORT Environment Variable (+1 more)

### Community 30 - "Render Service Config"
Cohesion: 0.22
Nodes (9): Deployment Start Command, Pre-Event Render Warmup, npm run start -w server, Render Free Plan, game123 Render Service, Node Runtime, Node.js 22, Render Start Command (+1 more)

### Community 31 - "Shared Game Concepts"
Cohesion: 0.25
Nodes (9): npm Test Unit Tests, GhostAI, GhostReplicaAI, Authoritative Ghost and Client Replica Boundary, Shared Socket Protocol, Ranking Logic, Shared Workspace, Client GhostReplicaAI (+1 more)

### Community 32 - "Host Camera Tests"
Cohesion: 0.28
Nodes (4): CAMERA_MODES, distance(), labelPosition(), pollLabelDistanceFrom()

### Community 34 - "Root Dev Tools"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently, eslint, eslint-config-prettier, @eslint/js, globals, @playwright/test, prettier (+1 more)

### Community 35 - "Server TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, types, extends, include, ../tsconfig.base.json

### Community 36 - "Verification Pipeline"
Cohesion: 0.25
Nodes (8): Deployment Build Command, Verify Skill, Prettier Format Check, npm Run Lint, npm Run Build Type Check, Repository Verification Workflow, npm run build, Render Build Command

### Community 37 - "Host Scene Integration"
Cohesion: 0.29
Nodes (8): Host Bird's-Eye Console Preview, Field Environment, Ghost Visual, HostConsolePanel, HostController, HostScene, InstancedMesh, Host Entry Point

### Community 38 - "Offline Gameplay Preview"
Cohesion: 0.43
Nodes (7): Alive Player Counter, Outdoor Game Arena, Giant Game Doll, Offline Player UI Preview, Left and Right Foot Controls, Numbered Player Avatars, 1-2-3 Wooden Man Game

### Community 39 - "Game Rules"
Cohesion: 0.29
Nodes (7): Decoupled Boost and Ghost RNG, GameRoom, Injected Game Time, normalizeRoomSettings, RoomSettings, Game State Machine, Waiting-Only Settings Updates

### Community 40 - "Project Documentation"
Cohesion: 0.29
Nodes (7): Repository Instructions, 123 木頭人 Game Project, Project README, 123 木頭人 / Red Light, Green Light, Host Bird's-Eye Console, npm CLI Issue 4828, Render Deployment Configuration

### Community 41 - "Reconnection Identity"
Cohesion: 0.29
Nodes (7): Browser localStorage, Persistent Player and Host Reconnection, RECONNECT_GRACE_MS, Socket.IO socket.id, Client localStorage Identity, Persistent Player and Host Identity, Transient Socket.IO socket.id

### Community 42 - "Host Effects"
Cohesion: 0.29
Nodes (5): FIELD_LENGTH, ActiveEffect, BIRDSEYE_LOOK_AT, BIRDSEYE_POSITION, HostAvatarInput

### Community 43 - "Root NPM Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, format:check, lint, test

### Community 44 - "Shared TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../tsconfig.base.json

### Community 45 - "Motion Tutorial Preview"
Cohesion: 0.40
Nodes (6): Motion Player Portrait UI Preview, Motion Mode, Music-Synchronized Movement, One-Step Advance Mechanism, Organizer Screen, Up-and-Down Motion Instruction

### Community 46 - "Workspace Structure"
Cohesion: 0.33
Nodes (6): Client Workspace, npm Workspaces Monorepo, Scripts Workspace, Three.js, TypeScript, Vite

### Community 47 - "Authoritative Gameplay"
Cohesion: 0.33
Nodes (6): Player, Server-Authoritative Judging, Server GhostAI, Shared Player Logic, Server-Side Game Judgment, Shared Configuration

### Community 48 - "Audio Gameplay Rhythm"
Cohesion: 0.33
Nodes (6): Web Audio Effects, Music-Synchronized Game Rhythm, Ghost Review Phase, 123 木頭人 MP3 Asset, MusicPlayer, Increasing Round Speed

### Community 49 - "Deterministic E2E Testing"
Cohesion: 0.40
Nodes (5): Gameplay or Socket Change, GHOST_TEST_SEED, Playwright End-to-End Tests, E2E Workspace, Deterministic Ghost Test Seed

### Community 50 - "Motion Sensing Preview"
Cohesion: 0.60
Nodes (5): Live Music-Guided Movement, Motion Player Sensing Mode Preview, 感應模式 (Motion Sensing Mode), One-Step Advance Per Vertical Motion, Organizer Screen

### Community 51 - "Server Tick Lifecycle"
Cohesion: 0.60
Nodes (5): client/dist Static Build, Single Global Tick Loop, Server Index, Build Client Before Static Serving, RoomManager.tickAll(now)

### Community 52 - "Server Socket Layer"
Cohesion: 0.40
Nodes (5): Express, RoomManager, Server Workspace, Socket Handlers, Socket.IO

### Community 54 - "Server State Broadcast"
Cohesion: 0.50
Nodes (5): ClockSync, GameRoom, RoomManager, Server Entry and Global Tick, Socket.IO Event Handlers

### Community 55 - "Same-Origin Deployment"
Cohesion: 0.50
Nodes (4): Same-Origin SocketClient Connection, Single-Origin Deployment, Root Vite Base Path, SocketClient

### Community 56 - "HTML Entry Points"
Cohesion: 0.67
Nodes (3): Host HTML Entry Point, Player HTML Entry Point, Purple Lightning Favicon

## Ambiguous Edges - Review These
- `Offline Player Mobile UI Preview` → `Red-Light/Green-Light Style Gameplay`  [AMBIGUOUS]
  artifacts/ui-previews/offline-player-mobile.png · relation: references

## Knowledge Gaps
- **272 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+267 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 362 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Offline Player Mobile UI Preview` and `Red-Light/Green-Light Style Gameplay`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Shared Workspace` connect `Shared Game Concepts` to `Shared Game Domain`, `Workspace Structure`, `Authoritative Gameplay`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `npm Workspaces Monorepo` connect `Workspace Structure` to `Project Documentation`, `Deterministic E2E Testing`, `Server Socket Layer`, `Shared Game Concepts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Repository Instructions` connect `Project Documentation` to `Workspace Structure`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _272 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Networked Player Client` be split into smaller, more focused modules?**
  _Cohesion score 0.0635814889336016 - nodes in this community are weakly interconnected._
- **Should `Shared Game Domain` be split into smaller, more focused modules?**
  _Cohesion score 0.05576923076923077 - nodes in this community are weakly interconnected._
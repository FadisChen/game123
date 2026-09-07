# Graph Report - game123  (2026-09-07)

## Corpus Check
- Large corpus: 106 files · ~609,008 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1016 nodes · 1976 edges · 68 communities (55 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 111 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Networked Game Runtime
- Verification Workflows
- Audio Playback
- Client Dependencies
- Server Game Room
- Game Timing Rules
- Host Gameplay UI
- Player Avatar Rendering
- Host Camera Concepts
- 3D Asset Pipeline
- Game Room Tests
- Server Dependencies
- Host Scene Rendering
- Networked Client Sync
- Socket Client Layer
- Socket Event Protocol
- Deployment Architecture
- Motion Input
- Client TypeScript Config
- Gameplay Screenshots
- Game Scene Rendering
- Session Persistence
- Player Rules
- Base TypeScript Config
- Gameplay Design Concepts
- UI Interaction Controls
- Shared Dependencies
- Player HUD
- Host Gameplay Preview
- Join Screen UI
- Visual Gameplay Assets
- Client Test Suites
- Root Tooling Config
- Deployment Documentation
- Formal Player UI
- Outcome Effects
- Game Rules Concepts
- Blender Asset Scripts
- Tutorial Concepts
- Game Over UI
- Offline Game Controller
- Network Timing
- Ranking Rules
- Host Camera Controller
- Host Camera Tests
- Tooling Dependencies
- Server TypeScript Config
- Control Mode UI
- Deployment Constraints
- Offline Gameplay Preview
- Player Step Events
- Waiting Screen UI
- Workspace Commands
- Server Player State
- Shared TypeScript Config
- Temporary Test Driver
- Temporary Step Driver
- Motion Tutorial UI
- Host Console Preview
- Motion Mode Preview
- Audio E2E Tests
- Reconnection State
- Player Resume Protocol
- HTML Entry Points
- Player View Previews
- Portrait Orientation
- Offline Gameplay Controller

## God Nodes (most connected - your core abstractions)
1. `GameRoom` - 43 edges
2. `SocketClient` - 42 edges
3. `NetworkedGameController` - 32 edges
4. `HostScene` - 29 edges
5. `HostConsolePanel` - 27 edges
6. `registerHostHandlers()` - 25 edges
7. `GameScene` - 23 edges
8. `HostController` - 22 edges
9. `Foot` - 22 edges
10. `HUD` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Host Scene Model Detail` --semantically_similar_to--> `Host Scene`  [INFERRED] [semantically similar]
  art/host-models-detail.png → README.md
- `Doll Facial Expression Scene` --semantically_similar_to--> `Programmatic Sprite Assets`  [INFERRED] [semantically similar]
  art/doll-expression.png → README.md
- `Masked Guard Character Preview` --semantically_similar_to--> `Programmatic Sprite Assets`  [INFERRED] [semantically similar]
  art/guard-preview.png → README.md
- `Host Scene Model Detail` --semantically_similar_to--> `Programmatic Sprite Assets`  [INFERRED] [semantically similar]
  art/host-models-detail.png → README.md
- `Bird's-Eye Host Scene Preview` --semantically_similar_to--> `Host Scene`  [INFERRED] [semantically similar]
  art/host-scene-preview.png → README.md

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
- **Game Architecture** — readme_player_mobile_controller, readme_host_console, readme_server_authoritative_judgment, readme_socket_io_protocol [INFERRED 0.85]
- **Authoritative State Flow** — readme_shared_logic_and_types, readme_game_room_state_machine, readme_socket_io_protocol, readme_networked_game_controller [INFERRED 0.85]
- **Visual Asset Preview Set** — readme_sprite_assets, art_doll_expression_doll_expression, art_guard_preview_guard_character, art_host_models_detail_host_models_detail, art_host_scene_preview_host_scene, art_player_preview_player_avatars [INFERRED 0.75]

## Communities (68 total, 12 thin omitted)

### Community 0 - "Networked Game Runtime"
Cohesion: 0.08
Nodes (48): socket.io, app, CLIENT_DIST, createRoomLimiter, __dirname, httpServer, io, joinRoomLimiter (+40 more)

### Community 1 - "Verification Workflows"
Cohesion: 0.05
Nodes (46): Deployment Build Command, Verify Skill, Prettier Format Check, Gameplay or Socket Change, GHOST_TEST_SEED, npm Run Lint, Playwright End-to-End Tests, npm Run Build Type Check (+38 more)

### Community 2 - "Audio Playback"
Cohesion: 0.10
Nodes (8): MusicPlayer, sfx, SfxEngine, SfxName, HostController, app, clearHostSession(), GhostVisualState

### Community 3 - "Client Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, qrcode, shared, socket.io-client, three, devDependencies, @types/qrcode, @types/three (+26 more)

### Community 4 - "Server Game Room"
Cohesion: 0.09
Nodes (7): createSessionToken(), GameRoom, roomJustStartedPlaying(), roomSettledIntoPlaying(), RoomSettings, GameOverReason, JoinErrorCode

### Community 5 - "Game Timing Rules"
Cohesion: 0.09
Nodes (10): GHOST_TURN_DURATION_MS, MUSIC_LOOKING_MAX_MS, MUSIC_LOOKING_MIN_MS, MUSIC_TRACK_DURATION_MS, musicPhaseDurationMs(), musicPlaybackRate(), computeFacingAmount(), GhostAI (+2 more)

### Community 6 - "Host Gameplay UI"
Cohesion: 0.11
Nodes (11): CAMERA_MODE_OPTIONS, HostConsolePanel, HostConsolePanelCallbacks, PHASE_LABEL, HostCameraMode, GameStatus, PLAYER_MODE_OPTIONS, SCORE_OPTIONS (+3 more)

### Community 7 - "Player Avatar Rendering"
Cohesion: 0.12
Nodes (16): FIELD_LENGTH, ALIVE_COLOR, AvatarState, COLLAPSE_DURATION_MS, COLLAPSE_ROLL_RAD, DEAD_COLOR, drawNameTexture(), easeOutCubic() (+8 more)

### Community 8 - "Host Camera Concepts"
Cohesion: 0.10
Nodes (27): Bird's-Eye Camera, Camera Control, Central Tree-Like Character, Configured Distance: 50.0 m, Free Camera, 3D Game Arena, Game Distance, Game Settings (+19 more)

### Community 9 - "3D Asset Pipeline"
Cohesion: 0.18
Nodes (20): assets, loadAsset(), loadBlenderPlayerGeometry(), loader, replaceWithBlenderAsset(), createCharacter(), createPlayerGeometry(), part() (+12 more)

### Community 10 - "Game Room Tests"
Cohesion: 0.14
Nodes (20): RoomEvent, noFakeTurnRng(), scriptedRng(), DEFAULT_ROOM_SETTINGS, MAX_GAME_DURATION_MS, MAX_PLAYERS_PER_ROOM, MAX_STEP_EVENTS_PER_WINDOW, MUSIC_INITIAL_PLAYBACK_RATE (+12 more)

### Community 11 - "Server Dependencies"
Cohesion: 0.08
Nodes (24): express, @types/express, dependencies, express, shared, socket.io, devDependencies, tsx (+16 more)

### Community 13 - "Networked Client Sync"
Cohesion: 0.24
Nodes (3): NetworkedGameController, RoomGameOverPayload, RoomStateSnapshot

### Community 14 - "Socket Client Layer"
Cohesion: 0.20
Nodes (4): SocketClient, ConnectionState, HostRoomActionAck, HostRoomActionPayload

### Community 15 - "Socket Event Protocol"
Cohesion: 0.11
Nodes (12): HostId, HostResumeRoomAck, HostResumeRoomPayload, PlayerId, PlayerJoinRoomPayload, ResumeErrorCode, RoomClosedPayload, RoomCode (+4 more)

### Community 16 - "Deployment Architecture"
Cohesion: 0.12
Nodes (19): client/dist Static Files, Cloud Run, Deployment Backlog, 60 Mobile Players Deployment Goal, Deployment Plan, Mobile QR End-to-End Smoke Check, Fly.io, GitHub Pages and Render Split Architecture (+11 more)

### Community 17 - "Motion Input"
Cohesion: 0.20
Nodes (4): DeviceMotionEventWithPermission, isSecureMotionContext(), MotionInput, oppositeFoot()

### Community 18 - "Client TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 19 - "Gameplay Screenshots"
Cohesion: 0.12
Nodes (16): Enclosed Game Arena, First-Person Gameplay View, Giant Game Doll, Green Tracksuit Players, Split-Screen Gameplay Screenshot, Masked Guards, Gameplay Minimap, Overhead Gameplay View (+8 more)

### Community 20 - "Game Scene Rendering"
Cohesion: 0.17
Nodes (3): lightScene(), GhostVisual, GameScene

### Community 21 - "Session Persistence"
Cohesion: 0.18
Nodes (11): getStoredHostSession(), getStoredPlayerSession(), HostSession, isNonEmptyString(), PlayerSession, readJson(), saveHostSession(), savePlayerSession() (+3 more)

### Community 22 - "Player Rules"
Cohesion: 0.17
Nodes (7): ToastVariant, CAUGHT_TOAST_MS, FINISH_DISTANCE_M, INITIAL_SCORE, LookingCheck, Player, StepResult

### Community 23 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, erasableSyntaxOnly, forceConsistentCasingInFileNames, lib, module, moduleDetection, moduleResolution, noFallthroughCasesInSwitch (+7 more)

### Community 24 - "Gameplay Design Concepts"
Cohesion: 0.22
Nodes (15): Alternating Direction Input, 50-Meter Distance Indicator, Giant Tree and Doll Landmark, Heart Life Indicator HUD, Offline Player Mobile UI Preview, Left Direction Control, Mobile Game Interface, Offline Player Mode (+7 more)

### Community 25 - "UI Interaction Controls"
Cohesion: 0.21
Nodes (9): buildFootButton(), installLandscapeGuard(), isLandscape(), requestLandscape(), MAIN_RULES, MOTION_RULES, TeachingScreen, FOOT_BUTTON_LOCKOUT_MS (+1 more)

### Community 26 - "Shared Dependencies"
Cohesion: 0.13
Nodes (14): devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node, typescript (+6 more)

### Community 28 - "Host Gameplay Preview"
Cohesion: 0.22
Nodes (13): Active Player Count (23/32), Camera Control Panel, Center Crosshair, Composite Player and Host Game UI, Countdown Timer (00:08), Doll Referee, First-Person Player View, Game Status HUD (+5 more)

### Community 29 - "Join Screen UI"
Cohesion: 0.21
Nodes (3): app, clearPlayerSession(), JoinScreen

### Community 30 - "Visual Gameplay Assets"
Cohesion: 0.21
Nodes (12): Doll Facial Expression Scene, Masked Guard Character Preview, Host Scene Model Detail, Player Avatar Preview, 123 木頭人 (Red Light, Green Light), ClockSync, Motion Input, Multiplayer 3D Game (+4 more)

### Community 32 - "Root Tooling Config"
Cohesion: 0.21
Nodes (10): name, private, workspaces, concurrently, eslint, eslint-config-prettier, @eslint/js, globals (+2 more)

### Community 33 - "Deployment Documentation"
Cohesion: 0.20
Nodes (11): Deployment Start Command, Health Check Endpoint, Playwright End-to-End Tests, Project README, Render Deployment Blueprint, Load Test, game123 Render Web Service, /healthz Health Check (+3 more)

### Community 34 - "Formal Player UI"
Cohesion: 0.29
Nodes (11): Finish Distance Indicator, Heart Status Indicator, Formal Player Game UI Preview, Leafless Tree Landmark, Left and Right Leg Movement Controls, Movement Instruction Overlay, Pink Masked NPCs, Player Count HUD (+3 more)

### Community 35 - "Outcome Effects"
Cohesion: 0.25
Nodes (3): ActiveEffect, OutcomeEffects, COLORS

### Community 36 - "Game Rules Concepts"
Cohesion: 0.24
Nodes (11): GameRoom State Machine, GhostAI State Machine, GhostReplicaAI, Global Server Tick, normalizeRoomSettings, Player Logic, Ranking Rules, RoomManager (+3 more)

### Community 37 - "Blender Asset Scripts"
Cohesion: 0.31
Nodes (9): box(), branch(), ellipsoid(), export(), finish(), limb(), material(), oval() (+1 more)

### Community 38 - "Tutorial Concepts"
Cohesion: 0.27
Nodes (10): 遊戲教學 / Game Tutorial, Giant Doll Referee, Offline Teaching Game UI Preview, Mouse and Keyboard Movement Controls, Movement Detection and Point Penalty, Music-Based Movement Signal, Numbered Player Characters, Finish-Line Victory Condition (+2 more)

### Community 39 - "Game Over UI"
Cohesion: 0.24
Nodes (5): GameState, GameOutcome, GameOverScreen, OUTCOME_COPY, FINAL_SPRINT_REMAINING_M

### Community 42 - "Ranking Rules"
Cohesion: 0.28
Nodes (4): computeRanking(), RankedPlayer, RankingInput, RankingOutcome

### Community 43 - "Host Camera Controller"
Cohesion: 0.25
Nodes (7): BIRDSEYE_LOOK_AT, BIRDSEYE_POSITION, easeInOutCubic(), HostAvatarInput, INTRO_FAR_POSITION, INTRO_ORBIT_CENTER, introOrbitPoint()

### Community 44 - "Host Camera Tests"
Cohesion: 0.28
Nodes (4): CAMERA_MODES, distance(), labelPosition(), pollLabelDistanceFrom()

### Community 45 - "Tooling Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently, eslint, eslint-config-prettier, @eslint/js, globals, @playwright/test, prettier (+1 more)

### Community 46 - "Server TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, noEmit, types, extends, include, ../tsconfig.base.json

### Community 48 - "Deployment Constraints"
Cohesion: 0.29
Nodes (7): Same-Origin SocketClient Connection, Single-Origin Deployment, Root Vite Base Path, In-Memory Room State, Session Resume, SocketClient, Socket.IO Protocol

### Community 49 - "Offline Gameplay Preview"
Cohesion: 0.43
Nodes (7): Alive Player Counter, Outdoor Game Arena, Giant Game Doll, Offline Player UI Preview, Left and Right Foot Controls, Numbered Player Avatars, 1-2-3 Wooden Man Game

### Community 50 - "Player Step Events"
Cohesion: 0.38
Nodes (3): Foot, PlayerStepPayload, RoomPlayerSteppedPayload

### Community 52 - "Workspace Commands"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, format:check, lint, test

### Community 53 - "Server Player State"
Cohesion: 0.29
Nodes (4): ServerPlayerState, toStepResultMsg(), StepErrorCode, StepResultMsg

### Community 54 - "Shared TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../tsconfig.base.json

### Community 55 - "Temporary Test Driver"
Cohesion: 0.33
Nodes (5): delay(), drive(), names, results, sessions

### Community 56 - "Temporary Step Driver"
Cohesion: 0.33
Nodes (5): delay(), drive(), missingNames, results, sessions

### Community 57 - "Motion Tutorial UI"
Cohesion: 0.40
Nodes (6): Motion Player Portrait UI Preview, Motion Mode, Music-Synchronized Movement, One-Step Advance Mechanism, Organizer Screen, Up-and-Down Motion Instruction

### Community 58 - "Host Console Preview"
Cohesion: 0.60
Nodes (5): Bird's-Eye Host Scene Preview, Host Bird's-Eye Console Preview, Host Console, Host Console Panel, Host Scene

### Community 59 - "Motion Mode Preview"
Cohesion: 0.60
Nodes (5): Live Music-Guided Movement, Motion Player Sensing Mode Preview, 感應模式 (Motion Sensing Mode), One-Step Advance Per Vertical Motion, Organizer Screen

### Community 61 - "Reconnection State"
Cohesion: 0.50
Nodes (4): Browser localStorage, Persistent Player and Host Reconnection, RECONNECT_GRACE_MS, Socket.IO socket.id

### Community 63 - "HTML Entry Points"
Cohesion: 0.67
Nodes (3): Host HTML Entry Point, Player HTML Entry Point, Purple Lightning Favicon

## Ambiguous Edges - Review These
- `Offline Player Mobile UI Preview` → `Red-Light/Green-Light Style Gameplay`  [AMBIGUOUS]
  artifacts/ui-previews/offline-player-mobile.png · relation: references

## Knowledge Gaps
- **264 isolated node(s):** `names`, `sessions`, `results`, `missingNames`, `sessions` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 371 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Offline Player Mobile UI Preview` and `Red-Light/Green-Light Style Gameplay`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Shared Workspace` connect `Verification Workflows` to `Game Room Tests`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `Playwright End-to-End Tests` connect `Verification Workflows` to `Deployment Constraints`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `names`, `sessions`, `results` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Networked Game Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.07806841046277666 - nodes in this community are weakly interconnected._
- **Should `Verification Workflows` be split into smaller, more focused modules?**
  _Cohesion score 0.051207729468599035 - nodes in this community are weakly interconnected._
- **Should `Audio Playback` be split into smaller, more focused modules?**
  _Cohesion score 0.10077519379844961 - nodes in this community are weakly interconnected._
# Zbojník Simulátor – working notes for Claude

Three.js 0.160 + TypeScript + Vite browser prototype (later ported to Unity – see `game_design_document.md`).
User speaks Slovak; reply in Slovak. All in-game text is Slovak.

## Token rules (user is on a limited plan)
- Work in **sessions** (plan below). One session = one conversation. Start it with: "Session N".
- Read ONLY the files the session lists. Use Grep for signatures instead of reading whole big files
  (`game.ts` 1.4k lines, `dialogs.ts` 1k, `world.ts` 860, `styles.css` 960, `character-model.ts` 630).
- Use `Read` with offset/limit around a Grep hit. Don't re-read a file you just edited.
- Verify with `npm run typecheck` (no browser runs unless the session says so – headless Chrome is blocked;
  Edge + puppeteer-core over pipe works but is slow).
- End of session: typecheck, tick the checklist below, add a short "Done" note, update the GDD if gameplay changed.
- `git` is not on PATH in PowerShell. PowerShell `Get-Content` garbles UTF‑8 – use the Read tool.

## Code map (`src/`, alias `@/`)
- `core/game.ts` – the `Game` god‑object: start/stop, update(dt) loop, render, interaction focus
  (`updateInteraction`), hotkeys (`handleHotkeys`: 1–4 items, B emotes, G fujara, M map, H disguise),
  travel (chodníky), ladders, bear, hideout, town quest, combat glue, banter, death/respawn, map markers.
- `core/app.ts` – renderer, scene, camera, sun (DirectionalLight + shadows), hemi light, FogExp2,
  EffectComposer: RenderPass → GradeShader (ShaderPass, damage flash) → OutputPass. ACES tone mapping.
  Dynamic resolution, quality switching. `core/scene-manager.ts` state stack; `core/game-loop.ts` fixed step.
- `config/quality.ts` – presets low/medium/high/ultra (pixelRatio, shadows, msaa, particles, clouds, mist,
  rain, drawDistance) + GPU detection. `config/constants.ts` – tuning numbers, `LOC` world positions,
  ECONOMY, COMPANION_TUNING, DISGUISE. `config/game-config.ts` – exposure, fog.
- `world/world.ts` – `World`: builds village, Rovná hora, salaš, Terchová, Mikuláš, gorge (Jánošíkove diery,
  ladders, hideout), stream, castle (`buildCastle`, just a prop now), roadside, forest (InstancedMesh spruces),
  rocks; colliders (grid of circles/boxes), signposts, wetness, mist.
- `world/terrain.ts` – height field (valley, river `riverZ`, road `roadZ`, gorge), `colorAt` vertex colours,
  chunked mesh, minimap. `world/props.ts` – procedural low‑poly prop factories (houses, stalls, castle, coach…).
- `world/materials.ts` – `mat()` (cached MeshStandardMaterial), `part()`, `at()`, stripe/sign textures,
  `bakeStatic()` merges static groups. `world/sky.ts` sky dome shader + clouds; `world/day-night.ts` keyframed
  sky/light/fog/exposure per hour; `world/weather.ts` rain/storm/lightning; `world/mist.ts` valley mist.
  `world/vegetation.ts` – `applyWind()` (onBeforeCompile sway, + `windDepthMaterial` for shadows), `Vegetation`
  (grass + flowers in 32 m chunks, distance-culled, density/fade/wind from quality preset; `update()` from Game render).
  Terrain helpers `forestNoise/meadowNoise/flowerNoise/grassCover` keep colours and placement in sync.
- `components/character-model.ts` – procedural humanoid (parts, poses, emotes, disguise). `entities/looks.ts`
  – per‑character colours/outfits. Entities: `player`, `companion`, `npc` (schedules, sleep), `enemy` (Pandur),
  `bear`, `coach`, `actor` (base), `attacks` (combo defs).
- `systems/` – quest-system (QUEST_STEPS linear list + CHAPTER_TITLES), combat, ambush (coach raid),
  town (suspicion/alarm in Mikuláš), camera-controller, input-system (bindings), audio-manager (all procedural
  WebAudio), particle-system (InstancedMesh cubes), weapon-trail, save-manager (SaveData, flags).
- `systems/patrol-system.ts` – drábi groups (Pandur with DRAB look, waypoint loops, sight/lose radius, respawn)
  + friendly zbojník bands (Npc with faction 'band', help vs alerted drábi). `entities/melee-brain.ts` – shared
  chase/windup/strike AI. `Npc` temper: calm → warned (1st hit) → hostile (2nd) → down (KO) + grudge; factions
  'civil'/'band' are hittable by the player. Player `armed` / R draws the valaška (`CharacterModel.setSheathed`).
- `systems/castle-system.ts` – Likava guards (Pandur, CASTLE_GUARD look with left-hand lantern): rounds/posts,
  vision cones (ground sector meshes), detection → investigate → alarm (also on finding a KO'd comrade), calm,
  respawn, one shared lantern PointLight. Castle geometry + colliders: `createCastle()` in props.ts (castle-local),
  `World.buildCastle`, cell doors `World.setDoor('cell0'..'cell2', open)` (switchable colliders, `off` flag),
  `World.lineClear()` for sight. Player `crouching` (C/Ctrl), `Game.sneakTakedowns()` = crouched blow from behind
  on an `unaware` Pandur → `knockOut()`. Debug: `zbojnik.castle()`, `zbojnik.door(id, open)`.
- `story/dialogs.ts` – `createNpcs`, `createInteractables` (all E‑interactions: NPC talk, ladders, hideout,
  signposts, chests, coach loot…), dialog trees, `CHODNIKY`. `story/lines.ts` – barks and flavour text.
  `Interactable.lowPriority` = loses focus to anything else in reach.
- `minigames/` – fujara, halusky, paka, pickpocket (base `minigame.ts`). `scenes/` – menu, game, dialog
  (E/Enter/Space/1‑9 pick options), minigame, overlay. `ui/` – hud, dialog box, menus, styles.css.
- `types/game-types.ts` – QuestStepId, NpcId, CompanionId, ItemId, SaveData. Debug: F3 overlay,
  `window.zbojnik.{god,money,skip,coach,tp,heal,look,time,weather,state,pools}` (`debug/debug-tools.ts`).

## Adding story content (pattern)
New chapter = steps in `QUEST_STEPS` + ids in `QuestStepId` + title in `CHAPTER_TITLES`, NPCs/interactables in
`dialogs.ts`, geometry in a new `World.buildX()`, objective marker in `Game.objectivePosition()`, flags in
SaveData, texts in `lines.ts`, numbers in `constants.ts`. Keep content data‑like (Unity port).

## Session plan
Graphics sessions should stay cheap and art‑direction driven (the final look comes from the Unity port).

- [x] **S1 Grafika – svet a vegetácia.** Files: `world/terrain.ts` (colorAt), `world/world.ts` (buildForest,
  buildRocks, buildRoadside), `world/props.ts` (spruce geo). Goals: richer terrain colour variation (meadow
  patches, flowers, dirt near paths), instanced grass tufts + bushes + a deciduous tree type, wind sway via
  `onBeforeCompile` on vegetation, gated by quality presets.
- [x] **S2 Grafika – svetlo a post‑process.** Files: `core/app.ts`, `config/quality.ts`, `world/day-night.ts`.
  Goals: bloom (UnrealBloomPass, high/ultra) for fire/lanterns/sun, vignette + subtle film grain in GradeShader,
  warmer golden hour / bluer night tuning, shadow cascade-ish follow (tighter extent near player).
- [x] **S3 Grafika – postavy.** Files: `components/character-model.ts`, `entities/looks.ts`. Goals: better
  proportions, faces (eyes, mustache), cloth details (opasok, krpce, vest embroidery), smoother pose blending.
- [x] **S4 Kapitola 6a – Likavský hrad.** Files: `world/world.ts` (new `buildCastleInterior`), `world/props.ts`,
  `entities/enemy.ts`. Goals: walkable castle (courtyard, gate, dungeon), night guards with lanterns on
  patrol routes, vision cones / detection meter (reuse town-system suspicion idea).
- [ ] **S5 Kapitola 6b – príbeh a kľúče.** Files: `systems/quest-system.ts`, `types/game-types.ts`,
  `story/dialogs.ts`, `story/lines.ts`, `core/game.ts` (objectivePosition), GDD. Goals: quest steps, keys,
  freeing prisoners, escape, rewards.
- [ ] **S6 Celkové vylepšenia.** HUD/UX polish, bug list from playtesting (user collects bugs between sessions).
- [ ] Later: Kapitola 7 Pltníci na Váhu (split into 7a world/raft, 7b story) … see GDD §3.4.

## Done
- Chapters 1–5 + free play.
- 2026-11-12: signpost fix – after fast travel the arrival signpost stays silent until you walk >3.5 m away;
  signposts are low priority for E. **Not yet tested in the browser – ask the user.**
- 2026-11-19 S1: terrain colours (meadows, lush river banks, dry slopes, forest floor, flower tinge, worn dirt by
  paths/road/village, scree), grass tufts + wildflowers (instanced, chunked), bushes, broadleaf trees at forest edges
  + lone meadow trees, tinted/mossy rocks (2 shapes), wind sway on grass/bushes/crowns (+ shadows).
  Quality: `grassDensity`, `grassDistance`, `wind` (low: 0.3/38 m/off … ultra: 1/120 m/on).
  **Not tested in the browser – check startup time, FPS on low, grass poking through floors.**
- 2026-11-19 S2: UnrealBloom (high/ultra, threshold 1.3 – flames/forge/lanterns/windows made HDR), film grain,
  grade uWarm (golden hour) / uNight (cool, desaturated), shadow texel snapping (`App.placeSun`), warmer dawn/dusk
  and bluer night keyframes. Quality: `bloom`, `grain`.
- 2026-11-19 gameplay (user request): valaška sheathed behind the belt (R / first attack draws), pandúri hp 115 +
  frontal parry, everyone attackable with warning → brawl → knock-out, drábi patrols + friendly bands (from c2).
  Smoke-tested in headless Edge (dev server, `window.zbojnik.town()` shows drabi/bands): no console errors,
  drábi spot & attack, bands walk. Not yet hand-played – ask the user about balance.
- 2026-11-19 S3: faces (sclera+iris, brows, ears, mouth that moves when talking, blinking, drooping fúzy), krpce with
  laces, vest embroidery (`vestTrim`), belt studs (`beltStuds`), bigger hands, all joints eased (damp 18, swings 45,
  spin raw). GDD §3.5 now has a character art bible for the Unity port. Debug `zbojnik.zoom(d)` added.
  **Art direction:** the final AAA look is made in Unity – keep web-prototype art cheap and data-driven
  (`CharacterLook` fields = modular costume parts), document intent in the GDD instead of polishing meshes.
- 2026-11-19 S4: walkable Likava (walls, towers, east gate + road through the forest, north-wall breach, palác,
  strážnica, stable, 3 barred cells), 7 guards with lanterns at night, vision cones + "Odhalenie" HUD meter,
  investigate/alarm/calm/respawn, crouch + silent takedown (works on all pandúri/drábi). Castle drábi patrol moved
  east of the walls. Headless-Edge checked: no errors, crouched at 6 m at night = unseen, standing = alarm;
  detection gain then lowered (0.3 + 1.3·closeness). S5 needs: quest steps, keys → `setDoor`, prisoners in cells.

# Zbojník Simulátor – prenos do Unity

Webová verzia (Three.js) je **hrateľný prototyp a špecifikácia**. Finálna hra vzniká v Unity s AAA grafikou.
Z webu sa prenáša **dizajn, dáta a pravidlá**, nie kód 1:1 ani grafika.

## 1. Stiahnutie doma

```bash
git clone https://github.com/Lukasin0/zbojnik-simulator.git
```

Bez gitu: na GitHube **Code → Download ZIP**, alebo GitHub Desktop → *Clone repository*.

Spustenie prototypu (treba Node.js 20+):

```bash
npm install
npm run dev        # http://localhost:5173
```

Online verzia: https://lukasin0.github.io/zbojnik-simulator/

## 2. Čo čítať najprv

| Súbor | Čo v ňom je |
|---|---|
| `game_design_document.md` | príbeh, kapitoly, mechaniky, **§3.5 systémy sveta + art bible postáv** |
| `CLAUDE.md` | mapa kódu, čo je hotové, poznámky ku každej session |
| `src/config/constants.ts` | **všetky čísla**: pozície miest (`LOC`), boj, ekonomika, hliadky, hrad, zakrádanie |
| `src/systems/quest-system.ts` | kroky úloh (`QUEST_STEPS`) a názvy kapitol |
| `src/story/dialogs.ts` | dialógy a všetky E-interakcie |
| `src/story/lines.ts` | hlášky (barks) – všetok slovenský text mimo dialógov |
| `src/entities/looks.ts` | vzhľad každej postavy = zoznam častí kroja a farieb |

Dáta sú zámerne „dátové“ (polia, záznamy), aby sa dali previesť na **ScriptableObjects** alebo JSON.

## 3. Mapovanie systémov na Unity

| Prototyp | Unity |
|---|---|
| `terrain.ts` (výškové pole, rieka, cesta, roklina) | Unity Terrain (heightmap z `heightAt`), splatmapy podľa `colorAt` |
| `vegetation.ts`, les v `world.ts` | Terrain trees/details alebo GPU instancing + vietor v shaderi (SpeedTree / Shader Graph) |
| `day-night.ts`, `weather.ts`, `sky.ts` | HDRP Physically Based Sky + Volumetric Clouds, kľúčové snímky ako `Volume` profily |
| `app.ts` (bloom, grain, grade) | HDRP Volume: Bloom, Film Grain, Color Adjustments, Tonemapping |
| `character-model.ts` + `looks.ts` | Humanoid rig, modulárne časti kroja (každé pole `CharacterLook` = mesh/materiál), blendshapes tváre |
| `player.ts`, `attacks.ts` | Character Controller + Animator (kombo, vír, tasenie valašky, prikrčenie) |
| `enemy.ts`, `melee-brain.ts`, `npc.ts` | NavMeshAgent + stavový automat (alebo Behavior Graph) |
| `patrol-system.ts`, `castle-system.ts` | waypointy ako `Transform`y v scéne; zorné kužele, odhalenie, poplach – logika 1:1 |
| `town-system.ts` | podozrenie v meste – logika 1:1 |
| `combat-system.ts` | Physics.OverlapSphere/kužeľ + `IHittable` |
| `quest-system.ts`, `save-manager.ts` | ScriptableObject s krokmi + JSON uloženie (`SaveData`) |
| `audio-manager.ts` (procedurálny zvuk) | nahradiť skutočnými nahrávkami (fujara, ľudovky), FMOD/Wwise voliteľne |
| `minigames/` | samostatné UI scény (fujara, halušky, paka, vreckovanie) |

## 4. Odporúčané poradie

1. **Projekt:** Unity 6, HDRP (AAA vzhľad), Input System, Cinemachine (kamera z `camera-controller.ts`).
2. **Svet:** terén doliny podľa `LOC` a `heightAt`, potom dedina, Rovná hora, salaš, hrad Likava.
3. **Jánošík:** pohyb, kamera, valaška (tasenie spoza opaska), kombo, prikrčenie.
4. **Nepriatelia:** pandúri/drábi s vykrývaním, potom hliadky a hradná stráž so zorným kužeľom.
5. **Príbeh:** prepis `QUEST_STEPS` + dialógov do ScriptableObjects, kapitola po kapitole.
6. **Ostatné:** dedinčania (rozvrh, bitky s varovaním), družina, minihry, počasie, deň/noc.

Pravidlo: keď sa v Unity mení **dizajn**, zapíše sa to do `game_design_document.md`, aby GDD ostalo jediným zdrojom pravdy.

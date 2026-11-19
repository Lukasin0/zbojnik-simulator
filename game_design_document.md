# GAME DESIGN DOCUMENT: ZBOJNÍK SIMULÁTOR

> **Žáner:** 2.5D / Low-Poly RPG & Zbojnícky Simulátor  
> **Téma:** Slovenský historický folklór, boj proti panskej tyranii, zbojnícka družina, čierny humor a blato  
> **Cieľová platforma:** Webový prehliadač (JavaScript / HTML5 / Three.js), neskôr preklopenie do Unity pre Steam  

---

## 1. PRÍBEHOVÉ POZADIE (LORE)

Hmla nad Liptovom sa váľa po mokrých lúkach ako premočená ovčia kožušina. V takomto počasí by pes vonku nevystrčil nos – teda pokiaľ by naňho v chotári nečakali panskí drábi s bejkovačkou v ruke.

Juraj Jánošík sa vrátil z vojen preč z cisárskej armády na Bytčianskom hrade. Vidí, ako bohatí buržoázni páni, zemania a skorumpovaná vrchnosť drancujú a drajú z kože obyčajných ľudí. Rozhodne sa, že sa na to nebude len tak pozerať. 

Keď ho starý parťák Tomáš Uhorčík zasvätí do zbojníckeho remesla a neskôr mu odovzdá kapitánske kormidlo, Juraj zloží tvrdú prísahu pod vatrou na Rovnej hore. Zrodenie kapitána je dokonané: **bohatým brať, chudobným dávať a pánom ukázať, zač je v Liptove lokteš!**

---

## 2. KĽÚČOVÉ HERNÉ MECHANIKY

### 2.1 Core Loop (Hlavná herná slučka)
1. **Verbovanie fellákov:** V šenku (krčme) nahrabávaš zbojníckych druhov (Uhorčík, Ilčík...).
2. **Prieskum & Informácie:** Zisťovanie typov na panskú smotánku cez sieť tajných agentov a bačov na salašoch.
3. **Prepad na hradskej:** Nastavovanie pascí, tiché plíženie v lese, boj s pandúrmi a odzbrojenie koča.
4. **Rozdeľovanie koristi:** Časť dukátov ide chudobe (zvyšovanie reputácie), časť na výbavu a pálenku.
5. **Logistika lupu:** Ukrývanie cenností u prechovávačov (brat Ján v Terchovej, Uhorčík v Klenovci).

### 2.2 Atribúty a Výbava Jánošíka
* **Zdravie (HP):** Doplňuje sa jedlom (parenica, slanina, bryndzové halušky).
* **Stamina (Energia):** Spotrebúva sa pri sekaní valaškou, šprinte a zbojníckych výskokoch.
* **Morálka / Ráž:** Zvyšuje sa hraním na fujare a pitím hriateho. Dá meču/valaške extra damage.
* **Široký opatok (Opasok):** Čím širší kožený opasok s prackami máš, tým viac HP a slotov na mešce získaš.
* **Krk-pce & Klobúk:** Určujú rýchlosť pohybu v blate a celkovú charizmu pri verbovaní.

---

## 3. HLAVNÉ MISIE A SIDEQUESTY

### 3.1 Hlavná línia (Kampaň)
* **Kapitola 1: Prísaha na Rovnej hore**
  * Previerka zdatnosti: šerm, streľba z kresadlovky, zápasenie a legendárny skok cez vysokú vatru.
* **Kapitola 2: Felláci z Liptova**
  * Verbovanie prvých členov v krčmách (vyhrávanie v páke, platenie rundy borovičky).
* **Kapitola 3: Prepad panského koča na Váhu**
  * Zatarasenie cesty spadnutým kmeňom, boj s panskou hliadkou a vyžmýkanie zemanov o dukáty.

### 3.2 Sidequesty & Slovenský Flavor
* **Minihra: Bryndzové halušky**
  * Zohnať zemiaky, bryndzu zo salaša a vyškvariť slaninu. Rytmické miešanie pri kotlíku – posilní celú družinu.
* **Minihra: Umenie Fujary**
  * Guitar Hero štýl stláčania klávesov. Zahranie pred prepadom uspička pandúrske stráže na hradskej.
* **Minihra: Páka v šenku**
  * Preťahovanie sa rukou pri stolu na získanie rešpektu medzi lokálnymi chlapmi.

### 3.3 Pokračovanie kampane (hotové vo web prototype)

* **Kapitola 4: Jarmok v Mikuláši**
  * Šenkár dá tip na výbercu daní Gašpara Mastného → gazdiná Mara ušije **handlársky kabát** (20 d) → cesta po hradskej na východ do **Liptovského Mikuláša** → **vreckovanie** výbercu zozadu (minihra) → útek z mesta skôr, než si všimne (25 s) → 60 d vdove Hane pre okradnutých kramárov.
  * Mesto: námestie s dlažbou, radnica s hodinovou vežou, kostol, meštianske domy, hostinec U Zlatej husi, pranier, 6 stánkov, plagát „HĽADÁ SA“.
  * Výberca chodí po okruhu od stánku k stánku, pri každom zdaní niečo absurdné; kramár za ním hundre.
* **Kapitola 5: Jánošíkove diery**
  * Brat Ján: „hľadá ťa celá stolica“ → drevorubač Ondráš v Dolných dierach dá povraz → výstup úzkou roklinou cez 3 vodopády po rebríkoch (prostredný zlomený, treba ho zviazať) → v jaskyni pod previsom spí **medveď Dunčo** → vyhnať ho valaškou (480 HP, uteká pri 25 %) alebo **fujarou** (Dunčo odtancuje odzemok a odíde, +25 ráž) → zariadiť úkryt (ohnisko, lôžka z čečiny, stôl 15 d) → odzemok pri ohni s družinou.
  * Odmena: zbojnícka truhlica v úkryte (spoločná s Jánovou), nocľah zadarmo, **zbojnícke chodníky** (rýchle cestovanie medzi rázcestníkmi, uplynie 1 hodina).

### 3.4 Plán ďalších kapitol (6 – 13)

| # | Kapitola | Oblasť | Nová mechanika |
|---|---|---|---|
| 6 | Väzni z Likavského hradu | hrad zvnútra (nádvorie, žalár) | nočné plíženie, stráže s lampášmi, kľúče |
| 7 | Pltníci na Váhu | rieka, pltnícky prístav | splav na plti, boj na vode |
| 8 | Panská poľovačka | Kráľova hoľa, hlboký les | pasce, zvieratá |
| 9 | Zbojnícka svadba | koliba, lúka | tanečný súboj v odzemku (rytmická minihra) |
| 10 | Hajdúsky kapitán | pandúrska stanica | hľadanosť, boss |
| 11 | Tuhá zima | sneh na celej mape, Tatry | zimné obdobie, sane |
| 12 | Zrada v Klenovci | Klenovec | útek bez zbraní |
| 13 | Súd v Mikuláši | námestie | finálna bitka, výber konca |

### 3.5 Systémy sveta (pre prenos do Unity)

* **Denný cyklus:** 1 herná hodina = 60 s. Dedinčania majú rozvrh spánku (odchod k dverám, ráno von); v noci sa dá zaklopať. Ponocný s lampášom vyvoláva hodiny. Krčma, vatra a salaš nespia.
* **Počasie:** jasno / zamračené / dážď / búrka (blesky, hrom), mokrá zem = viac blata, v daždi pandúri horšie počujú.
* **Boj:** 3-úderové kombo (šikmý sek, sek späť, skok zhora), valaškový vír (stredné tlačidlo), kresadlovka cez rameno, zamrznutie pri zásahu. Pandúri, mestská stráž a medveď zdieľajú jeden systém zásahov.
* **Valaška za opaskom (R):** Jánošík nosí valašku zasunutú šikmo za opaskom; prvý úder ju vytasí (≈0,4 s), R ju zasunie. Vytasená valaška zruší prestrojenie, nasadenie prestrojenia ju zasunie.
* **Odolnejší protivníci:** pandúri/drábi majú viac zdravia a keď sú pripravení a hľadia na útočníka, vykryjú ~28 % úderov spredu a hneď kontrujú – oplatí sa útočiť zboku či zozadu.
* **Bitky s kýmkoľvek:** udrieť sa dá každého (bača, šenkár, kováč, mešťan…). Prvý úder = varovanie (25 s). Druhý = bitka; tuhší chlapi (bača, kováč, Uhorčík…) majú viac zdravia a silnejšiu ruku. Porazený nezomrie, ale leží omráčený (45 s, vypadne mu pár dukátov), potom sa 2 minúty hnevá a nerozpráva sa. Bitka na mikulášskom námestí privolá stráž. Družina sa pridá na kapitánovu stranu.
* **Hliadky:** od kapitoly 2 chodia panskí drábi v skupinách po 2–4 po trasách (okolie Likavského hradu, cesta popri salaši, lesy pri dedine). Zbadajú zbojníka na ~15 m (v noci 8 m, v prestrojení 3,5 m), ak ujde ďalej ako 42 m, vrátia sa na obchôdzku; vybitá hliadka sa po čase vráti. Po horách sa túlajú aj iné zbojnícke partie – zdravia kapitána a vrhnú sa na drábov, ktorí bojujú do 22 m od nich. Trasy a čísla: `PATROLS`, `PATROL_TUNING`, `BRAWL_TUNING` v `constants.ts`.
* **Prestrojenie (H):** stráže v meste bez neho napĺňajú ukazovateľ podozrenia; vytiahnutá valaška prestrojenie zruší.
* **Mapa:** jeden súvislý svet – dolina (dedina, Rovná hora, salaš, Terchová, hrad), údolie Váhu na východ, Liptovský Mikuláš a roklina Jánošíkove diery. Hory obkolesujú hrateľnú plochu.
* **Emócie (B):** mávanie, odzemok (družina sa pridá, +ráž), Hej-hou!, smiech, sadnúť si.
* **Postavy – art bible pre Unity (AAA):** web prototyp je len „maketa“; v Unity budú plnohodnotné riggované modely (Humanoid rig, LOD0–2, blendshapes tváre). Prototyp definuje *čo* postava nosí, nie *ako* vyzerá do detailu:
  * **Proporcie:** realistické, ~7,5 hlavy; zbojníci šľachovití, široké ramená; `girth` (1,0–1,55) = tučnosť/mohutnosť, `height` (0,92–1,08) = výška.
  * **Kroj = modulárne časti** (každé pole `CharacterLook` → samostatný mesh/materiál v Unity): košeľa s *rukávmi naširoko* (`wideSleeves`), nohavice/gate, *vesta* (`vest`) s *výšivkou* (`vestTrim` – okraje + ružice), široký *zbojnícky opasok* (`belt`, `beltLevel` 0–3 = šírka a počet prackách, `beltStuds` = mosadzné cvočky), *krpce* s remienkami omotanými okolo lýtok (`krpce`), pruhované *onuce* (`socks`), kabát/plášť (`coat`, `coatLong`, `cape`), sukňa a zástera (`skirt`, `apron`), klobúky (`hat`: zbojnícky s červenou stuhou a pierkom, bačovský, šako, čiapka, šatka, parochňa).
  * **Tvár:** oči s bielkom a farbou dúhovky (`eyeColor`), obočie, zvesené slovenské fúzy (`mustache`), brada (`beard`), vrkoče (`braids`); žmurkanie, zatvorené oči v spánku/omráčení, pohyb úst pri reči (v Unity: blendshapes + lip-sync).
  * **Výzbroj:** valaška v ruke alebo zasunutá šikmo za opaskom cez krížy (tasenie spoza pravého boku), šabľa, palica, lampáš, kresadlová pištoľ za opaskom.
  * **Animácie (zoznam pre mocap/Mixamo):** chôdza/šprint/skok, 3-úderové kombo (šikmý sek, sek späť, skok zhora), vír, mierenie a výstrel, tasenie/zasunutie valašky, zásah, smrť/omráčenie, sed, spánok, lezenie po rebríku, mávanie, smiech, Hej-hou, odzemok. Prechody medzi pózami sú plynulé (blend ~0,1 s, údery tvrdšie).
  * **Paleta:** prírodné ľanové biele (košele), hnedé kože, tmavomodrá pandúrov, tehlovočervená drábov, folklórne akcenty červená `#b3261e` / zlatožltá `#d8b440` / zelená `#3a6a2a`.
* **Dáta pre port:** úlohy `src/systems/quest-system.ts`, dialógy `src/story/dialogs.ts`, hlášky `src/story/lines.ts`, čísla a miesta `src/config/constants.ts`.

---

## 4. TECHNICKÝ STOH A ASSET PIPELINE

### Prehliadačová verzia (Web Prototype)
* **Language/Engine:** JavaScript + HTML5 Canvas / Three.js pre 3D renderovanie.
* **Modely:** Low-poly štýl (formát `.glb` / `.gltf`).
* **Zbrane a rekvizity:** Blockbench (vytvorenie valašky, parenice a kotlíka za pár minút).
* **Postavy:** Meshy.ai / Tripo3D (vygenerovanie Jánošíka a pandúrov) + Mixamo (rigging a animácie chôdze a sekania).

### Vyhliadka do budúcna (Unity & Steam)
* Preklopenie logiky z JavaScriptu do C# v Unity URP.
* Rozšírenie na otvorený svet Liptova a Oravy s dynamickým počasím a Steam achievements.
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
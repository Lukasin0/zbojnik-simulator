# Zbojník Simulátor

Low-poly 3D zbojnícke RPG z Liptova, ktoré beží priamo v prehliadači.
*Bohatým brať, chudobným dávať a pánom ukázať, zač je v Liptove lokteš!*

**Hrať:** odkaz nájdeš vpravo v sekcii *About / Deployments* (GitHub Pages).

## O hre

Juraj Jánošík sa vracia z vojny a skladá zbojnícku prísahu na Rovnej hore. Prototyp obsahuje tri kapitoly:

1. **Prísaha na Rovnej hore** – šerm, streľba z kresadlovky, zápasenie s Uhorčíkom a skok cez vatru.
2. **Felláci z Liptova** – verbovanie družiny v šenku (páka alebo runda borovičky).
3. **Prepad panského koča na Váhu** – zoťať smrek cez hradskú, uspať pandúrov fujarou, poraziť hliadku, rozdeliť korisť chudobe a ukryť lup u brata Jána.

Navyše: bryndzové halušky, kováč (širší opasok, klobúk s pierkom, krpce), páka o dukáty s Ferom Silákom a voľná hra s ďalšími kočmi.

## Ovládanie

| Klávesy | Akcia |
|---|---|
| W A S D + myš | pohyb a kamera (klikni do hry) |
| Shift / Medzerník | šprint / skok |
| Ľavé tlačidlo / J | sek valaškou (3-úderové kombo) |
| Stredné tlačidlo / Q | valaškový vír |
| B | emócie (mávanie, odzemok, Hej-hou!…) |
| Pravé tlačidlo / F | drž = mierenie, pusti = výstrel |
| E | hovoriť / použiť |
| G | fujara |
| 1–4 | jedlo a pitie |
| M | mapa |
| Esc | pauza |

Funguje aj gamepad.

## Spustenie lokálne

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produkčná verzia do dist/
```

Postavené na Three.js, TypeScripte a Vite. Modely, zvuky aj hudba sú generované procedurálne.

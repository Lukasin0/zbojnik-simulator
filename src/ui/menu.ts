import { GAME_CONFIG } from '@/config/game-config';
import { QUALITY_LEVELS, QUALITY_PRESETS, type QualityLevel } from '@/config/quality';
import type { App } from '@/core/app';
import type { AudioManager } from '@/systems/audio-manager';
import { createButton, el } from './button';

export interface MainMenuActions {
  canContinue: boolean;
  onNew(): void;
  onContinue(): void;
  onSettings(): void;
  onControls(): void;
  onImport(): void;
}

export function createMainMenu(art: HTMLImageElement | undefined, a: MainMenuActions): HTMLDivElement {
  const root = el('div', 'menu interactive');
  const left = el('div', 'menu-left');
  left.innerHTML = `
    <h1>Zbojník<span>Simulátor</span></h1>
    <div class="embroidery"></div>
    <p class="tagline">Bohatým brať, chudobným dávať a pánom ukázať, zač je v Liptove lokteš!</p>`;
  const stack = el('div', 'stack');
  if (a.canContinue) stack.appendChild(createButton('Pokračovať', a.onContinue, { variant: 'primary' }));
  stack.appendChild(createButton('Nová hra', a.onNew, { variant: a.canContinue ? 'default' : 'primary' }));
  stack.appendChild(createButton('Ovládanie', a.onControls));
  stack.appendChild(createButton('Nastavenia', a.onSettings));
  stack.appendChild(createButton('Načítať kód uloženia', a.onImport));
  left.appendChild(stack);
  root.appendChild(left);
  const right = el('div', 'menu-art');
  if (art) {
    const img = art.cloneNode() as HTMLImageElement;
    img.alt = 'Juraj Jánošík';
    right.appendChild(img);
  }
  root.appendChild(right);
  root.appendChild(el('div', 'version', `v${GAME_CONFIG.version} · prototyp`));
  return root;
}

function overlay(): { root: HTMLDivElement; panel: HTMLDivElement } {
  const root = el('div', 'overlay interactive');
  const panel = el('div', 'panel');
  root.appendChild(panel);
  return { root, panel };
}

export function createControlsPanel(onClose: () => void): HTMLDivElement {
  const { root, panel } = overlay();
  panel.innerHTML = `
    <h2>Ovládanie</h2>
    <div class="controls-grid">
      <kbd>W A S D</kbd><span>pohyb</span>
      <kbd>Myš</kbd><span>otáčanie kamery (klikni do hry), koliesko = priblíženie</span>
      <kbd>Shift</kbd><span>šprint (míňa silu)</span>
      <kbd>Medzerník</kbd><span>skok – so šprintom zbojnícky výskok</span>
      <kbd>Ľavé tl. / J</kbd><span>sek valaškou – klikaj v rytme pre 3-úderové kombo</span>
      <kbd>Stredné tl. / Q</kbd><span>valaškový vír – silný úder dookola (veľa sily)</span>
      <kbd>B</kbd><span>emócie: mávanie, odzemok, Hej-hou!, smiech, sadnúť si</span>
      <kbd>Pravé tl. / F</kbd><span>drž = mierenie cez rameno, pusti = výstrel z kresadlovky</span>
      <kbd>E</kbd><span>hovoriť / použiť</span>
      <kbd>G</kbd><span>zahrať na fujare (ráž, uspávanie pandúrov)</span>
      <kbd>1 – 4</kbd><span>slanina, parenica, halušky, borovička</span>
      <kbd>M</kbd><span>veľká mapa</span>
      <kbd>Esc / P</kbd><span>pauza</span>
      <kbd>Gamepad</kbd><span>ľavá páčka pohyb, pravá kamera, A skok, X sek, B použiť, Y fujara</span>
    </div>`;
  const s = el('div', 'stack');
  s.style.marginTop = '18px';
  s.appendChild(createButton('Späť', onClose));
  panel.appendChild(s);
  return root;
}

export function createSettingsPanel(audio: AudioManager, app: App, onClose: () => void): HTMLDivElement {
  const { root, panel } = overlay();
  panel.innerHTML = '<h2>Nastavenia</h2>';
  const slider = (label: string, channel: 'master' | 'music' | 'sfx'): void => {
    const row = el('div', 'setting');
    const lbl = el('label', '', label);
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = String(Math.round(audio.settings[channel] * 100));
    const val = el('span', '', input.value);
    input.addEventListener('input', () => {
      audio.setVolume(channel, Number(input.value) / 100);
      val.textContent = input.value;
    });
    row.append(lbl, input, val);
    panel.appendChild(row);
  };
  slider('Hlasitosť', 'master');
  slider('Hudba', 'music');
  slider('Efekty', 'sfx');
  const check = (label: string, value: boolean, fn: (v: boolean) => void): void => {
    const row = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => fn(input.checked));
    row.append(input, document.createTextNode(label));
    panel.appendChild(row);
  };
  check('Stlmiť zvuk', audio.settings.muted, () => audio.toggleMute());

  const qualityRow = el('div', 'setting quality');
  const qualityLabel = el('label', '', 'Grafika');
  const select = el('select');
  for (const level of QUALITY_LEVELS) {
    const opt = el('option');
    opt.value = level;
    opt.textContent = QUALITY_PRESETS[level].label + (level === app.gpu.suggested ? ' (odporúčaná)' : '');
    opt.selected = level === app.graphics.quality;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => app.setQuality(select.value as QualityLevel));
  qualityRow.append(qualityLabel, select);
  panel.appendChild(qualityRow);
  const gpu = el('p', 'gpu-info');
  gpu.textContent = `Grafická karta: ${app.gpu.name}`;
  panel.appendChild(gpu);
  check('Dynamické rozlíšenie (plynulosť pred ostrosťou)', app.graphics.dynamicResolution, (v) =>
    app.setDynamicResolution(v),
  );
  check('Zobraziť FPS', app.graphics.showFps, (v) => app.setShowFps(v));
  const s = el('div', 'stack');
  s.style.marginTop = '18px';
  s.appendChild(createButton('Celá obrazovka', () => app.toggleFullscreen()));
  s.appendChild(createButton('Späť', onClose));
  panel.appendChild(s);
  return root;
}

export interface PauseActions {
  onResume(): void;
  onSave(): void;
  onExport(): string;
  onSettings(): void;
  onControls(): void;
  onMenu(): void;
}

export function createPauseMenu(a: PauseActions): HTMLDivElement {
  const { root, panel } = overlay();
  panel.innerHTML = '<h2>Pauza</h2><p>Zbojníci si oddýchli pri vatre.</p>';
  const s = el('div', 'stack');
  s.appendChild(createButton('Pokračovať', a.onResume, { variant: 'primary' }));
  s.appendChild(createButton('Uložiť hru', a.onSave));
  const exportBox = el('textarea', 'save-code');
  exportBox.readOnly = true;
  exportBox.style.display = 'none';
  s.appendChild(
    createButton('Exportovať kód uloženia', () => {
      exportBox.value = a.onExport();
      exportBox.style.display = 'block';
      exportBox.select();
    }),
  );
  s.appendChild(exportBox);
  s.appendChild(createButton('Ovládanie', a.onControls));
  s.appendChild(createButton('Nastavenia', a.onSettings));
  s.appendChild(createButton('Hlavné menu', a.onMenu));
  panel.appendChild(s);
  return root;
}

export function createImportPanel(onImport: (code: string) => boolean, onClose: () => void): HTMLDivElement {
  const { root, panel } = overlay();
  panel.innerHTML = '<h2>Načítať kód uloženia</h2><p>Vlož kód, ktorý si si exportoval v pauze.</p>';
  const area = el('textarea', 'save-code');
  const msg = el('p');
  const s = el('div', 'stack');
  s.appendChild(
    createButton(
      'Načítať',
      () => {
        if (!onImport(area.value)) msg.textContent = 'Tento kód nie je platný.';
      },
      { variant: 'primary' },
    ),
  );
  s.appendChild(createButton('Späť', onClose));
  panel.append(area, msg, s);
  return root;
}

export function createInfoScreen(
  title: string,
  text: string,
  stats: [string, string][],
  buttons: { label: string; primary?: boolean; fn: () => void }[],
): HTMLDivElement {
  const { root, panel } = overlay();
  panel.innerHTML = `<h2></h2><p></p>`;
  (panel.querySelector('h2') as HTMLElement).textContent = title;
  (panel.querySelector('p') as HTMLElement).textContent = text;
  if (stats.length > 0) {
    const grid = el('div', 'stats');
    for (const [k, v] of stats) {
      const a = el('span');
      a.textContent = k;
      const b = el('span');
      b.textContent = v;
      grid.append(a, b);
    }
    panel.appendChild(grid);
  }
  const s = el('div', 'stack');
  for (const b of buttons) s.appendChild(createButton(b.label, b.fn, { variant: b.primary ? 'primary' : 'default' }));
  panel.appendChild(s);
  return root;
}

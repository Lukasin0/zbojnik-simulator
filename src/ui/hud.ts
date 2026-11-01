import * as THREE from 'three';
import { HOTBAR, ITEMS, WORLD_SIZE } from '@/config/constants';
import type { ToastKind } from '@/types/events';
import type { ItemId } from '@/types/game-types';
import { el } from './button';

export interface PartyEntry {
  name: string;
  hp: number;
  maxHp: number;
  downed: boolean;
}

export interface HudState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  raz: number;
  dukaty: number;
  capacity: number;
  stash: number;
  reputation: number;
  inventory: Record<ItemId, number>;
  party: PartyEntry[];
  chapter: string;
  objective: string;
  hint: string;
  crosshair: boolean;
  aiming: boolean;
  /** 0..1 musket reload progress */
  reload: number;
  buff: string;
  clickHint: boolean;
}

export interface MapMarker {
  x: number;
  z: number;
  color: string;
  label?: string;
  size?: number;
}

const ICONS: Record<ItemId, string> = {
  slanina: '🥓',
  parenica: '🧀',
  halusky: '🍲',
  borovicka: '🍶',
  zemiaky: '🥔',
  bryndza: '🧈',
};

interface Bark {
  el: HTMLDivElement;
  target: THREE.Object3D;
  until: number;
}

const tmp = new THREE.Vector3();

/** Heads-up display: vitals, money, party, objective, minimap, hotbar, prompts, toasts, barks. */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly hpBar: HTMLDivElement;
  private readonly stBar: HTMLDivElement;
  private readonly razBar: HTMLDivElement;
  private readonly hpLbl: HTMLSpanElement;
  private readonly money: HTMLDivElement;
  private readonly buffEl: HTMLDivElement;
  private readonly party: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly minimap: HTMLCanvasElement;
  private readonly mapCtx: CanvasRenderingContext2D | null;
  private readonly clock: HTMLDivElement;
  private readonly suspicion: HTMLDivElement;
  private readonly emotes: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private readonly ingredients: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly barkLayer: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly clickHint: HTMLDivElement;
  private barks: Bark[] = [];
  private last = new Map<string, string>();
  private bigMap = false;

  constructor(
    parent: HTMLElement,
    private readonly mapImage: HTMLCanvasElement,
  ) {
    this.root = el('div', 'hud hidden');
    const tl = el('div', 'hud-tl');
    const mkBar = (cls: string, label: string): [HTMLDivElement, HTMLSpanElement] => {
      const b = el('div', `bar ${cls}`);
      const fill = el('div', 'fill');
      const lbl = el('span', 'lbl', label);
      b.append(fill, lbl);
      tl.appendChild(b);
      return [fill, lbl];
    };
    [this.hpBar, this.hpLbl] = mkBar('hp', 'Zdravie');
    [this.stBar] = mkBar('st', 'Sila');
    [this.razBar] = mkBar('raz', 'Ráž');
    this.money = el('div', 'money');
    this.buffEl = el('div', 'buff');
    this.party = el('div', 'party');
    tl.append(this.money, this.buffEl, this.party);

    const tr = el('div', 'hud-tr');
    this.objective = el('div', 'objective', '<div class="chapter"></div><div class="text"></div><div class="hint"></div>');
    this.minimap = el('canvas', 'minimap');
    this.minimap.width = 340;
    this.minimap.height = 340;
    this.mapCtx = this.minimap.getContext('2d');
    this.clock = el('div', 'clock');
    this.suspicion = el('div', 'suspicion');
    this.suspicion.innerHTML = '<span>Podozrenie</span><i></i>';
    tr.append(this.objective, this.minimap, this.clock, this.suspicion);

    this.hotbar = el('div', 'hotbar');
    this.ingredients = el('div', 'ingredients');
    this.prompt = el('div', 'prompt');
    this.crosshair = el('div', 'crosshair');
    this.toasts = el('div', 'toasts');
    this.barkLayer = el('div');
    this.card = el('div', 'chapter-card', '<div class="num"></div><div class="title"></div><div class="embroidery"></div>');
    this.clickHint = el('div', 'click-hint', 'Klikni do hry pre ovládanie kamery myšou');
    this.emotes = el('div', 'emotes');

    this.root.append(
      tl,
      tr,
      this.hotbar,
      this.ingredients,
      this.prompt,
      this.crosshair,
      this.barkLayer,
      this.card,
      this.clickHint,
      this.emotes,
    );
    parent.append(this.root, this.toasts);
    this.buildHotbar();
  }

  private buildHotbar(): void {
    HOTBAR.forEach((id, i) => {
      const slot = el('div', 'slot');
      slot.dataset.item = id;
      slot.innerHTML = `<span class="key">${i + 1}</span><span class="icon">${ICONS[id]}</span>${ITEMS[id].name.split(' ').pop() ?? ''}<span class="count"></span>`;
      slot.title = `${ITEMS[id].name}: ${ITEMS[id].desc}`;
      this.hotbar.appendChild(slot);
    });
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    if (!v) this.setPrompt(null);
  }

  private changed(key: string, value: string): boolean {
    if (this.last.get(key) === value) return false;
    this.last.set(key, value);
    return true;
  }

  update(s: HudState): void {
    this.hpBar.style.transform = `scaleX(${Math.max(0, s.hp / s.maxHp)})`;
    this.stBar.style.transform = `scaleX(${Math.max(0, s.stamina / s.maxStamina)})`;
    this.razBar.style.transform = `scaleX(${Math.max(0, s.raz / 100)})`;
    if (this.changed('hpLbl', `${Math.ceil(s.hp)}/${s.maxHp}`)) this.hpLbl.textContent = `Zdravie ${Math.ceil(s.hp)}/${s.maxHp}`;

    const moneyKey = `${s.dukaty}|${s.capacity}|${s.stash}|${s.reputation}`;
    if (this.changed('money', moneyKey)) {
      this.money.innerHTML =
        `<span class="coin">⛀ ${s.dukaty}<small>/${s.capacity}</small></span>` +
        `<span title="Ukryté u brata Jána">🗝 ${s.stash}</span>` +
        `<span title="Reputácia u ľudu">♥ ${s.reputation}</span>`;
      this.money.classList.toggle('full', s.dukaty >= s.capacity);
    }
    if (this.changed('buff', s.buff)) this.buffEl.textContent = s.buff;

    const partyKey = s.party.map((p) => `${p.name}${Math.ceil(p.hp)}${p.downed}`).join('|');
    if (this.changed('party', partyKey)) {
      this.party.innerHTML = '';
      for (const p of s.party) {
        const row = el('div', `party-member${p.downed ? ' down' : ''}`);
        row.innerHTML = `<span>${p.name}${p.downed ? ' ✝' : ''}</span><div class="bar hp"><div class="fill" style="transform:scaleX(${Math.max(0, p.hp / p.maxHp)})"></div></div>`;
        this.party.appendChild(row);
      }
    }

    const objKey = `${s.chapter}|${s.objective}|${s.hint}`;
    if (this.changed('obj', objKey)) {
      (this.objective.querySelector('.chapter') as HTMLElement).textContent = s.chapter;
      (this.objective.querySelector('.text') as HTMLElement).textContent = s.objective;
      (this.objective.querySelector('.hint') as HTMLElement).textContent = s.hint;
      this.objective.classList.remove('flash');
      void this.objective.offsetWidth;
      this.objective.classList.add('flash');
    }

    const invKey = HOTBAR.map((id) => s.inventory[id]).join(',');
    if (this.changed('inv', invKey)) {
      this.hotbar.querySelectorAll<HTMLDivElement>('.slot').forEach((slot) => {
        const id = slot.dataset.item as ItemId;
        const n = s.inventory[id];
        (slot.querySelector('.count') as HTMLElement).textContent = n > 0 ? String(n) : '';
        slot.classList.toggle('empty', n <= 0);
      });
    }
    const ing = `${s.inventory.zemiaky}|${s.inventory.bryndza}`;
    if (this.changed('ing', ing)) {
      this.ingredients.textContent =
        s.inventory.zemiaky + s.inventory.bryndza > 0
          ? `Na halušky: ${ICONS.zemiaky} ${s.inventory.zemiaky}  ${ICONS.bryndza} ${s.inventory.bryndza}  ${ICONS.slanina} ${s.inventory.slanina}`
          : '';
    }
    this.crosshair.classList.toggle('show', s.crosshair || s.aiming);
    this.crosshair.classList.toggle('aim', s.aiming);
    this.crosshair.classList.toggle('loading', s.reload < 1);
    this.crosshair.style.setProperty('--reload', `${Math.round(s.reload * 360)}deg`);
    this.clickHint.classList.toggle('show', s.clickHint);
  }

  setClock(text: string, night: boolean, icon: string): void {
    if (this.changed('clock', `${text}|${night}|${icon}`)) {
      this.clock.textContent = `${icon} ${text}`;
      this.clock.classList.toggle('night', night);
    }
  }

  /** null hides the emote menu. */
  /** Town guards' suspicion meter (null hides it). */
  setSuspicion(v: number | null): void {
    const key = v === null ? 'off' : (Math.round(v * 20) / 20).toFixed(2);
    if (!this.changed('suspicion', key)) return;
    this.suspicion.classList.toggle('show', v !== null);
    const bar = this.suspicion.querySelector('i');
    if (bar && v !== null) bar.style.width = `${Math.round(Math.min(1, v) * 100)}%`;
  }

  showEmotes(names: string[] | null): void {
    if (!names) {
      this.emotes.classList.remove('show');
      return;
    }
    this.emotes.innerHTML = '<div class="emotes-title">Emócie – stlač číslo</div>';
    names.forEach((n, i) => {
      const row = el('div', 'emote');
      row.innerHTML = `<kbd>${i + 1}</kbd> `;
      row.append(document.createTextNode(n));
      this.emotes.appendChild(row);
    });
    this.emotes.classList.add('show');
  }

  setPrompt(text: string | null): void {
    if (this.changed('prompt', text ?? '')) {
      if (text) this.prompt.innerHTML = text;
      this.prompt.classList.toggle('show', text !== null);
    }
  }

  toast(text: string, kind: ToastKind = 'info', seconds = 3.2): void {
    const t = el('div', `toast ${kind}`);
    t.textContent = text;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => t.classList.add('out'), seconds * 1000);
    window.setTimeout(() => t.remove(), seconds * 1000 + 450);
  }

  chapterCard(num: number, title: string): void {
    (this.card.querySelector('.num') as HTMLElement).textContent = num <= 3 ? `KAPITOLA ${num}` : 'EPILÓG';
    (this.card.querySelector('.title') as HTMLElement).textContent = title;
    this.card.classList.add('show');
    window.setTimeout(() => this.card.classList.remove('show'), 3800);
  }

  bark(target: THREE.Object3D, text: string, seconds: number, now: number): void {
    this.barks = this.barks.filter((b) => {
      if (b.target === target) {
        b.el.remove();
        return false;
      }
      return true;
    });
    const e = el('div', 'bark');
    e.textContent = text;
    this.barkLayer.appendChild(e);
    this.barks.push({ el: e, target, until: now + seconds });
  }

  updateBarks(camera: THREE.Camera, now: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.barks = this.barks.filter((b) => {
      if (now > b.until || !b.target.parent) {
        b.el.remove();
        return false;
      }
      b.target.getWorldPosition(tmp);
      tmp.y += 2.3;
      const dist = tmp.distanceTo(camera.position);
      tmp.project(camera);
      const visible = tmp.z < 1 && dist < 45;
      b.el.style.display = visible ? 'block' : 'none';
      b.el.style.left = `${((tmp.x + 1) / 2) * w}px`;
      b.el.style.top = `${((1 - tmp.y) / 2) * h}px`;
      return true;
    });
  }

  toggleBigMap(): void {
    this.bigMap = !this.bigMap;
    this.minimap.classList.toggle('big', this.bigMap);
  }

  /** Draw the map: the big map shows the whole valley, the small one a window around the player. */
  drawMap(px: number, pz: number, yaw: number, markers: MapMarker[], objective: { x: number; z: number } | null): void {
    const g = this.mapCtx;
    if (!g) return;
    const S = this.minimap.width;
    const half = WORLD_SIZE / 2;
    // the big map frames the open land (valley + Mikuláš), not the empty mountains around it
    const span = this.bigMap ? 720 : 150;
    const cx = this.bigMap ? 125 : px;
    const cz = this.bigMap ? 15 : pz;
    const toMap = (x: number, z: number): [number, number] => [((x - cx) / span + 0.5) * S, ((z - cz) / span + 0.5) * S];
    g.save();
    g.clearRect(0, 0, S, S);
    if (!this.bigMap) {
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      g.clip();
    }
    const srcScale = this.mapImage.width / WORLD_SIZE;
    g.drawImage(
      this.mapImage,
      (cx - span / 2 + half) * srcScale,
      (cz - span / 2 + half) * srcScale,
      span * srcScale,
      span * srcScale,
      0,
      0,
      S,
      S,
    );
    g.font = `${this.bigMap ? 15 : 13}px Alegreya SC, serif`;
    g.textAlign = 'center';
    for (const m of markers) {
      const [x, y] = toMap(m.x, m.z);
      if (x < -10 || y < -10 || x > S + 10 || y > S + 10) continue;
      g.fillStyle = m.color;
      g.strokeStyle = '#120d0a';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, m.size ?? 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (m.label && this.bigMap) {
        g.fillStyle = '#f3ead6';
        g.strokeText(m.label, x, y - 9);
        g.fillText(m.label, x, y - 9);
      }
    }
    if (objective) {
      let [ox, oy] = toMap(objective.x, objective.z);
      const r = S / 2 - 12;
      const dx = ox - S / 2;
      const dy = oy - S / 2;
      const d = Math.hypot(dx, dy);
      if (!this.bigMap && d > r) {
        ox = S / 2 + (dx / d) * r;
        oy = S / 2 + (dy / d) * r;
      }
      g.fillStyle = '#ffd34a';
      g.strokeStyle = '#120d0a';
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? 10 : 4.5;
        g.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    // player arrow (map +z is down, yaw 0 faces +z)
    const [ax, ay] = toMap(px, pz);
    g.translate(ax, ay);
    g.rotate(-yaw);
    g.fillStyle = '#d8432f';
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 11);
    g.lineTo(7, -7);
    g.lineTo(0, -3);
    g.lineTo(-7, -7);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}

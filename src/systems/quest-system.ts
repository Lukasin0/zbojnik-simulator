import type { QuestStepId } from '@/types/game-types';

export interface QuestStepDef {
  id: QuestStepId;
  chapter: number;
  /** Objective text; `{n}` is replaced with the step counter. */
  text: string;
  goal?: number;
  hint?: string;
}

export const CHAPTER_TITLES: Record<number, string> = {
  1: 'Prísaha na Rovnej hore',
  2: 'Felláci z Liptova',
  3: 'Prepad panského koča na Váhu',
  4: 'Jarmok v Mikuláši',
  5: 'Jánošíkove diery',
  6: 'Kapitán Liptova',
};

export const QUEST_STEPS: QuestStepDef[] = [
  { id: 'c1_talk', chapter: 1, text: 'Vyjdi na Rovnú horu a prihovor sa Uhorčíkovi pri vatre.' },
  {
    id: 'c1_serm',
    chapter: 1,
    text: 'Šerm: rozsekaj slamených pánov valaškou ({n}/3)',
    goal: 3,
    hint: 'Ľavé tlačidlo myši / J – seknúť valaškou',
  },
  {
    id: 'c1_strelba',
    chapter: 1,
    text: 'Streľba: zostreľ terče kresadlovkou ({n}/3)',
    goal: 3,
    hint: 'Drž pravé tlačidlo myši (alebo F) – mieriš cez rameno, pusti – výstrel.',
  },
  { id: 'c1_zapas', chapter: 1, text: 'Zápasenie: prihovor sa Uhorčíkovi a polož ho na lopatky.' },
  {
    id: 'c1_skok',
    chapter: 1,
    text: 'Preskoč vysokú vatru!',
    hint: 'Rozbehni sa so Shiftom a skoč medzerníkom priamo cez oheň.',
  },
  { id: 'c1_prisaha', chapter: 1, text: 'Zlož zbojnícku prísahu u Uhorčíka.' },
  {
    id: 'c2_verbuj',
    chapter: 2,
    text: 'Naverbuj fellákov v šenku v dedine ({n}/2)',
    goal: 2,
    hint: 'Ilčík a Gajdošík sedia pri stoloch pred šenkom.',
  },
  { id: 'c2_baca', chapter: 2, text: 'Zájdi za bačom na salaš – vraj vie o panskom koči.' },
  {
    id: 'c3_strom',
    chapter: 3,
    text: 'Zotni smrek s červenou stuhou pri hradskej a zataras cestu.',
    hint: 'Sekaj do stromu valaškou. Fujarou [G] potom môžeš pandúrov uspať.',
  },
  {
    id: 'c3_prepad',
    chapter: 3,
    text: 'Koč sa blíži od západu! Prepadni panskú hliadku.',
    hint: 'Zahraj na fujare [G] skôr, než ťa zbadajú – pandúri zadriemu.',
  },
  { id: 'c3_lup', chapter: 3, text: 'Vyžmýkaj zemana v koči o dukáty.' },
  { id: 'c3_rozdel', chapter: 3, text: 'Rozdeľ korisť chudobe – prihovor sa starej Kataríne v dedine.' },
  { id: 'c3_ukry', chapter: 3, text: 'Ukry zvyšok lupu u brata Jána v Terchovej.' },
  { id: 'c4_tip', chapter: 4, text: 'Šenkár Ďurko vraj počul novinky z Mikuláša. Zastav sa v šenku.' },
  {
    id: 'c4_prestroj',
    chapter: 4,
    text: 'Zožeň si prestrojenie – gazdiná Mara šije kabáty pre handlárov.',
    hint: 'Mara chodí po dedine pri studni. V noci spí – zaklop jej na dvere.',
  },
  {
    id: 'c4_cesta',
    chapter: 4,
    text: 'Choď na jarmok do Liptovského Mikuláša – na východ po hradskej.',
    hint: 'Klávesom H si oblečieš alebo vyzlečieš prestrojenie. Bez neho ťa pandúri v meste spoznajú.',
  },
  {
    id: 'c4_vreckuj',
    chapter: 4,
    text: 'Nájdi na jarmoku výbercu daní a ukradni mu mešec – zozadu, potichu.',
    hint: 'Jarmok je otvorený cez deň (7:00 – 19:00). Priblíž sa k výbercovi zozadu a stlač E.',
  },
  {
    id: 'c4_utek',
    chapter: 4,
    text: 'Zmizni z mesta, kým si výberca všimne, že mešec je preč!',
    hint: 'Choď von z Mikuláša – ďalej ako za vdovinu chalupu pri hradskej.',
  },
  { id: 'c4_rozdel', chapter: 4, text: 'Vráť okradnutým kramárom ich groše – daj podiel vdove Hane pod mestom.' },
  { id: 'c5_jan', chapter: 5, text: 'Po Mikuláši ťa hľadá celá stolica. Zájdi za bratom Jánom do Terchovej.' },
  {
    id: 'c5_ondras',
    chapter: 5,
    text: 'Nájdi drevorubača Ondráša v roklinách nad Terchovou.',
    hint: 'Chodník vedie z Terchovej na sever, do úzkej skalnej rokliny.',
  },
  {
    id: 'c5_vystup',
    chapter: 5,
    text: 'Vystúp roklinou po rebríkoch na Horné diery ({n}/3)',
    goal: 3,
    hint: 'Pri rebríku stlač E. Zlomený rebrík oprav povrazom od Ondráša.',
  },
  {
    id: 'c5_medved',
    chapter: 5,
    text: 'V úkryte sa rozvalil medveď! Vyžeň ho – valaškou, alebo mu zahraj na fujare.',
    hint: 'Fujara [G] zblízka ho možno rozveselí. Valaškou to bude dlhý tanec.',
  },
  {
    id: 'c5_zariad',
    chapter: 5,
    text: 'Zariaď zbojnícky úkryt ({n}/3)',
    goal: 3,
    hint: 'Ohnisko, lôžka a stôl – pri každom mieste stlač E.',
  },
  {
    id: 'c5_hostina',
    chapter: 5,
    text: 'Zvolaj družinu k ohňu a osláv nový úkryt odzemkom!',
    hint: 'Pri ohni stlač B a vyber Odzemok (2).',
  },
  {
    id: 'free',
    chapter: 6,
    text: 'Voľná hra: prepadávaj koče, pomáhaj chudobe. Zbojnícke chodníky ťa prevedú po Liptove.',
  },
];

/** Linear campaign state machine with a per-step counter. */
export class QuestSystem {
  constructor(
    private getStep: () => QuestStepId,
    private setStep: (id: QuestStepId, counter: number) => void,
    private getCounter: () => number,
    private onAdvance: (from: QuestStepDef, to: QuestStepDef) => void,
  ) {}

  get step(): QuestStepId {
    return this.getStep();
  }

  get def(): QuestStepDef {
    return QUEST_STEPS.find((s) => s.id === this.getStep()) ?? QUEST_STEPS[0];
  }

  get counter(): number {
    return this.getCounter();
  }

  get chapter(): number {
    return this.def.chapter;
  }

  is(...ids: QuestStepId[]): boolean {
    return ids.includes(this.getStep());
  }

  /** True when the current step comes at or after `id`. */
  reached(id: QuestStepId): boolean {
    return QUEST_STEPS.findIndex((s) => s.id === this.getStep()) >= QUEST_STEPS.findIndex((s) => s.id === id);
  }

  objectiveText(): string {
    return this.def.text.replace('{n}', String(Math.min(this.counter, this.def.goal ?? 0)));
  }

  /** Count progress on a counting step; advances automatically when the goal is met. */
  progress(id: QuestStepId, amount = 1): void {
    if (this.getStep() !== id) return;
    const n = this.getCounter() + amount;
    const goal = this.def.goal ?? 1;
    if (n >= goal) this.advance(id);
    else this.setStep(id, n);
  }

  /** Complete step `id` (no-op when it is not the current one). */
  advance(id: QuestStepId): void {
    if (this.getStep() !== id) return;
    const idx = QUEST_STEPS.findIndex((s) => s.id === id);
    const next = QUEST_STEPS[Math.min(idx + 1, QUEST_STEPS.length - 1)];
    const from = QUEST_STEPS[idx];
    this.setStep(next.id, 0);
    this.onAdvance(from, next);
  }
}

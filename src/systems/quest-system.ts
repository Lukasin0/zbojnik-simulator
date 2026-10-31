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
  4: 'Kapitán Liptova',
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
    hint: 'Pravé tlačidlo myši / F – výstrel (mieri sa na stred obrazovky)',
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
  {
    id: 'free',
    chapter: 4,
    text: 'Voľná hra: pýtaj si u bača typy na pánov, prepadávaj koče, pomáhaj chudobe.',
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

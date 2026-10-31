import type { ItemId, QuestStepId } from './game-types';

export type ToastKind = 'info' | 'good' | 'bad' | 'quest';

/** Typed payloads for the global game event bus. */
export interface GameEvents {
  toast: { text: string; kind?: ToastKind };
  'quest:advanced': { from: QuestStepId; to: QuestStepId };
  'chapter:start': { chapter: number; title: string };
  'item:changed': { item: ItemId; count: number };
  'player:hurt': { amount: number };
  'player:died': { lost: number };
  'combat:start': { enemies: number };
  'combat:end': { won: boolean };
  'save:requested': { reason: string };
}

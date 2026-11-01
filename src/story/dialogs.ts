import * as THREE from 'three';
import { ECONOMY, ITEMS, LOC } from '@/config/constants';
import type { Game } from '@/core/game';
import {
  BACA,
  DREVORUBAC,
  FERO,
  GAJDOSIK,
  GAZDINA,
  HANA,
  HOSTINSKY,
  ILCIK,
  JAN,
  KATARINA,
  KOVAC,
  KRAMAR,
  KRAMARKA,
  KRCMAR,
  MESTAN,
  PONOCNY,
  SEDLIAK,
  UHORCIK,
  VYBERCA,
} from '@/entities/looks';
import { PickpocketGame } from '@/minigames/pickpocket';
import { Npc } from '@/entities/npc';
import { HaluskyGame } from '@/minigames/halusky';
import { PakaGame } from '@/minigames/paka';
import type { CompanionId, ItemId, NpcId } from '@/types/game-types';
import type { DialogNode, DialogOption } from '@/ui/dialog';
import {
  BACA_WISDOM,
  KOVAC_JOKES,
  HANA_THANKS,
  KRAMAR_TALK,
  KRCMAR_GOSSIP,
  MESTAN_TALK,
  ONDRAS_TALK,
  PONOCNY_TALK,
  POSTER_TEXT,
  VILLAGER_HIGH,
  VILLAGER_LOW,
  VILLAGER_MID,
  WOKEN,
  WOKEN_JAN,
  WOKEN_KATARINA,
  WOKEN_KOVAC,
  ZEMAN_AFTER,
  ZEMAN_PLEA,
  line,
} from './lines';

export interface Interactable {
  id: string;
  radius: number;
  position(): THREE.Vector3;
  /** null = not available right now */
  label(): string | null;
  act(): void;
}

export function createNpcs(game: Game): Npc[] {
  const s = game.app.scene;
  const w = game.world;
  const v = LOC.vatra;
  const k = LOC.krcma;
  const face = (fx: number, fz: number, tx: number, tz: number): number => Math.atan2(tx - fx, tz - fz);
  const doors = w.doors;
  // the krčma, the bonfire and the salaš never sleep; everybody else goes to bed
  return [
    new Npc('uhorcik', 'Tomáš Uhorčík', UHORCIK, s, v.x + 3, v.z + 3.5, face(v.x + 3, v.z + 3.5, v.x, v.z), w),
    new Npc('ilcik', 'Ilčík', ILCIK, s, k.x - 11, k.z - 4.5, Math.PI / 2, w, 'sit'),
    new Npc('gajdosik', 'Gajdošík', GAJDOSIK, s, k.x - 9, k.z + 4.5, -Math.PI / 2, w, 'sit'),
    new Npc('krcmar', 'Šenkár Ďurko', KRCMAR, s, k.x - 6, k.z + 1.5, -Math.PI / 2, w),
    new Npc('fero', 'Fero Silák', FERO, s, k.x - 7.5, k.z - 8, -Math.PI / 2, w),
    new Npc('baca', 'Bača Ondrej', BACA, s, LOC.salas.x + 3, LOC.salas.z - 4, face(LOC.salas.x + 3, LOC.salas.z - 4, LOC.kotlik.x, LOC.kotlik.z + 6), w),
    new Npc('kovac', 'Kováč Mišo', KOVAC, s, LOC.shop.x + 1, LOC.shop.z - 2.6, Math.PI, w).sleepsAt(doors.kovac, 21.5, 6),
    new Npc('katarina', 'Stará Katarína', KATARINA, s, LOC.poor.x, LOC.poor.z - 1.2, Math.PI, w).sleepsAt(doors.katarina, 20, 6.5),
    new Npc('jan', 'Brat Ján', JAN, s, LOC.terchova.x, LOC.terchova.z + 4.2, 0, w).sleepsAt(doors.jan, 22, 5.5),
    new Npc('sedliak1', 'Sedliak Jano', SEDLIAK, s, 24, 24, 0, w, 'normal', 9).sleepsAt(doors.jano, 21, 5),
    new Npc('sedliak2', 'Sedliak Paľo', SEDLIAK, s, 38, 30, 1, w, 'normal', 6).sleepsAt(doors.palo, 20.5, 5.5),
    new Npc('gazdina', 'Gazdiná Mara', GAZDINA, s, 22, 12, 2, w, 'normal', 5).sleepsAt(doors.mara, 20, 5),
    new Npc('ponocny', 'Ponocný Ignác', PONOCNY, s, 32, 22, 0, w, 'normal', 18).sleepsAt(doors.ponocny, 5.5, 20.5),
    ...createTownNpcs(game),
  ];
}

/** Liptovský Mikuláš: market vendors (fair 7–19), townsfolk, the innkeeper, the výberca and widow Hana. */
function createTownNpcs(game: Game): Npc[] {
  const s = game.app.scene;
  const w = game.world;
  const m = LOC.mikulas;
  const st = w.stalls;
  const doors = w.doors;
  // the výberca's round: in front of every stall, row A (south-facing) then back along row B
  const round = [
    w.ground(m.x - 22, m.z - 5.8),
    w.ground(m.x - 12, m.z - 5.8),
    w.ground(m.x + 12, m.z - 5.8),
    w.ground(m.x + 22, m.z - 5.8),
    w.ground(m.x + 17, m.z + 5.8),
    w.ground(m.x - 17, m.z + 5.8),
  ];
  const hana = doors.hana;
  return [
    new Npc('kramar1', 'Hrnčiar Imro', KRAMAR, s, st[0].x, st[0].z, 0, w).sleepsAt(doors.mestoW0, 19, 7),
    new Npc('kramar2', 'Kapustárka Anča', KRAMARKA, s, st[1].x, st[1].z, 0, w).sleepsAt(doors.mestoW1, 19, 7),
    new Npc('kramar3', 'Medovnikárka Bora', KRAMARKA, s, st[2].x, st[2].z, 0, w).sleepsAt(doors.mestoE0, 19, 7),
    new Npc('kramar4', 'Čižmár Lojzo', KRAMAR, s, st[5].x, st[5].z, Math.PI, w).sleepsAt(doors.mestoE1, 19, 7),
    new Npc('mestan1', 'Mešťan Ferdinand', MESTAN, s, m.x - 8, m.z + 3, 0, w, 'normal', 14).sleepsAt(doors.mestoW2, 21, 6),
    new Npc('mestan2', 'Mešťanka Rozália', KRAMARKA, s, m.x + 8, m.z - 3, 1, w, 'normal', 12).sleepsAt(doors.hostinec, 20.5, 6.5),
    new Npc('hostinsky', 'Hostinský Kubo', HOSTINSKY, s, doors.hostinec.x - 0.8, doors.hostinec.z + 2, -Math.PI / 2, w),
    new Npc('vyberca', 'Výberca Gašpar Mastný', VYBERCA, s, round[0].x, round[0].z, 0, w).sleepsAt(doors.vyberca, 18.5, 7.5).walksRoute(round),
    new Npc('hana', 'Vdova Hana', HANA, s, hana.x, hana.z + 0.6, 0, w).sleepsAt(hana, 20.5, 6),
    new Npc('ondras', 'Drevorubač Ondráš', DREVORUBAC, s, w.ondrasPos.x, w.ondrasPos.z, Math.PI, w),
  ];
}

// --------------------------------------------------------------------------- helpers

function npcAt(game: Game, id: NpcId, radius: number, label: () => string | null, act: () => void): Interactable {
  return {
    id,
    radius,
    position: () => game.npcs.get(id)?.position ?? new THREE.Vector3(0, -999, 0),
    label: () => (game.npcs.get(id)?.model.root.visible === false ? null : label()),
    act,
  };
}

function talk(game: Game, id: NpcId, text: string, options?: DialogOption[]): DialogNode {
  const npc = game.npcs.get(id);
  return { speaker: npc?.displayName ?? '', text, options };
}

function buyOption(game: Game, item: ItemId, price: number, back: () => DialogNode): DialogOption {
  return {
    label: `${ITEMS[item].name} – ${price} dukátov (${ITEMS[item].desc})`,
    disabled: game.data.dukaty < price,
    action: () => {
      if (game.spend(price)) {
        game.giveItem(item);
        game.toast(`Kúpil si: ${ITEMS[item].name}`, 'good');
      }
      return back();
    },
  };
}

const bye: DialogOption = { label: 'Zbohom.' };

// --------------------------------------------------------------------------- Uhorčík

function uhorcikDialog(game: Game): DialogNode {
  const q = game.quests;
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'uhorcik', text, options);
  switch (q.step) {
    case 'c1_talk':
      return t(
        'Juraj! Tak predsa si prišiel. Vojenčina ťa naučila pochodovať a salutovať pánom, ale zbojník musí vedieť viac.\n\nRozsekaj tých troch slamených pánov – nech vidím, či valaška v tvojej ruke nie je len na štípanie triesok.',
        [{ label: 'Ukážem ti, Tomáš.', action: () => q.advance('c1_talk') }],
      );
    case 'c1_serm':
      return t('Slamení páni ešte stoja. Seknúť ľavým tlačidlom myši – tak, ako by si sekal do pánskej pýchy.');
    case 'c1_strelba':
      return t(
        'Teraz kresadlovka. Terče stoja na západnom svahu. Drž pravé tlačidlo, zamier krúžkom na terč a pusti. A pamätaj – kým nabiješ, pandúr ťa trikrát ovalí.',
      );
    case 'c1_zapas':
      return t('Tak, a teraz ja a ty. Zápas! Kto padne na chrbát, platí borovičku celej Rovnej hore.', [
        {
          label: 'Poďme na to! (zápas)',
          action: () => {
            game.startMinigame(new PakaGame({ opponent: 'Uhorčíkom', strength: 0.85, mode: 'zapas' }, game.audio), (r) => {
              if (r.won) {
                game.toast('Uhorčík leží na lopatkách!', 'good');
                q.advance('c1_zapas');
                game.openDialog(t('Uf… tie vojenské chlebíky ti zjavne nevadili. Dobre. Ešte jedna skúška – vatra!'));
              } else if (!r.aborted) {
                game.openDialog(t('Ha! Ešte si mäkký ako čerstvá parenica. Nadýchni sa a skús znova.'));
              }
            });
          },
        },
        { label: 'Ešte nie.' },
      ]);
    case 'c1_skok':
      return t(
        'Posledná skúška – skok cez vatru. Rozbehni sa (Shift), skoč (medzerník) a preleť ponad plamene.\n\nStarí zbojníci hovoria: kto vatru preskočí, toho guľa nevezme. Kto nepreskočí, ten aspoň nebude mať blchy.',
      );
    case 'c1_prisaha':
      return t(
        'Juraj Jánošík, prisaháš pod touto vatrou, že bohatým budeš brať a chudobným dávať? Že nezradíš družinu a pánom ukážeš, zač je v Liptove lokteš?',
        [
          {
            label: 'Prisahám!',
            action: () => {
              game.data.flags.captain = true;
              game.recruit('uhorcik');
              q.advance('c1_prisaha');
              return {
                speaker: 'Tomáš Uhorčík',
                text: 'Tak od dnešného dňa si naším kapitánom! Tá valaška je odteraz kapitánska – seká o kus tvrdšie.\n\nPôjdem s tebou. V dedine pred šenkom sedia chlapi, čo by sa k nám pridali – Ilčík a Gajdošík. Ale zadarmo nejde nikto: buď ich porazíš v páke, alebo zaplatíš rundu.',
              };
            },
          },
          { label: 'Ešte si to rozmyslím.' },
        ],
      );
    default:
      return t('Kapitán, ja som tu. Povedz kam, a moja valaška ide s tebou.');
  }
}

// --------------------------------------------------------------------------- recruits

function recruitDialog(game: Game, id: CompanionId, strength: number, intro: string, lose: string): DialogNode {
  const q = game.quests;
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, id, text, options);
  if (!q.reached('c2_verbuj')) return t('Čo chceš, chlapče? Najprv sa ukáž na Rovnej hore, potom sa môžeme baviť.');
  const cost = game.roundCost;
  const charismaMul = Math.max(0.6, 1 - game.charisma * 0.12);
  return t(intro, [
    {
      label: 'Páka! (minihra)',
      action: () => {
        game.startMinigame(new PakaGame({ opponent: game.npcs.get(id)?.displayName ?? '', strength: strength * charismaMul, mode: 'paka' }, game.audio), (r) => {
          if (r.won) {
            game.recruit(id);
            game.openDialog(t('Hej, tak to bola ruka! Idem s tebou, kapitán.'));
          } else if (!r.aborted) {
            game.openDialog(t(lose));
          }
        });
      },
    },
    {
      label: `Zaplatím celému šenku rundu borovičky (${cost} dukátov)`,
      disabled: game.data.dukaty < cost,
      action: () => {
        if (!game.spend(cost)) return;
        game.sfx('drink');
        game.recruit(id);
        return t('Na zdravie kapitánovi! Kto platí rundu, za tým aj do pekla pôjdem.');
      },
    },
    { label: 'Neskôr.' },
  ]);
}

// --------------------------------------------------------------------------- šenk

function krcmarDialog(game: Game): DialogNode {
  const discount = game.data.reputation >= 40 ? 1 : 0;
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'krcmar', text, options);
  if (game.quests.is('c4_tip')) {
    return t(
      'Kapitán! Dobre, že ideš. V Mikuláši je jarmok a chodí po ňom výberca daní Gašpar Mastný. Berie kramárom aj posledný groš – vraj už zdanil aj kapustu, čo ešte len vyrastie.\n\nMešec nosí na opasku, plný ako moja bečka po Vianociach. Ale pozor: v meste visia plagáty s tvojou tvárou. V zbojníckom klobúku ťa pandúri spoznajú skôr, ako povieš „dobrý deň“.\n\nGazdiná Mara šije handlárske kabáty. V takom by ťa nespoznala ani vlastná mama.',
      [{ label: 'Mastný, hovoríš? Tak ho trochu odľahčíme.', action: () => game.quests.advance('c4_tip') }],
    );
  }
  const node = (): DialogNode =>
    t('Čo si dáš, kapitán? Slanina je dnes ešte teplá a borovička studená. Ako má byť.', [
      buyOption(game, 'slanina', ITEMS.slanina.price - discount, node),
      buyOption(game, 'borovicka', ITEMS.borovicka.price - discount, node),
      {
        label: 'Čo nové v dedine?',
        action: () => t(line(KRCMAR_GOSSIP, game.rng), [{ label: 'Hehe. Ešte niečo?', action: node }, bye]),
      },
      innOption(game, 'krcmar'),
      bye,
    ]);
  return node();
}

/** Sleep until morning in the šenk or the Mikuláš inn. */
function innOption(game: Game, id: NpcId): DialogOption {
  const night = game.dayNight.time >= 18 || game.dayNight.time < 5;
  return {
    label: `Prespať sa do rána (${ECONOMY.innPrice} dukáty)`,
    disabled: !night || game.data.dukaty < ECONOMY.innPrice,
    action: () => {
      if (!game.spend(ECONOMY.innPrice)) return;
      game.sleepUntilMorning();
      return talk(game, id, 'Dobré ráno, kapitán! Chrápal si tak, že sa pandúri v Ružomberku budili.');
    },
  };
}

// --------------------------------------------------------------------------- Liptovský Mikuláš

function hostinskyDialog(game: Game): DialogNode {
  const node = (): DialogNode =>
    talk(game, 'hostinsky', 'Vitajte U Zlatej husi! Husi už nemáme, výberca ich zdanil. Ale slanina a posteľ sa nájdu.', [
      buyOption(game, 'slanina', ITEMS.slanina.price + 1, node),
      buyOption(game, 'parenica', ITEMS.parenica.price + 1, node),
      innOption(game, 'hostinsky'),
      bye,
    ]);
  return node();
}

function maraDialog(game: Game): DialogNode {
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'gazdina', text, options);
  const price = ECONOMY.disguisePrice;
  return t(
    'Handlársky kabát? Pre teba, Juraj? Hehe, ušijem ti taký, že ťa nespozná ani vlastný kôň. Čapica, kabát po kolená a krošňa na chrbát – budeš vyzerať ako ten, čo predáva hrebene a kupuje klebety.',
    [
      {
        label: `Ušite mi ho, gazdiná (${price} dukátov)`,
        disabled: game.data.dukaty < price,
        action: () => {
          if (!game.spend(price)) return;
          game.data.flags.hasDisguise = true;
          game.toast('Máš handlársky kabát! Klávesom H ho oblečieš a vyzlečieš.', 'quest');
          game.quests.advance('c4_prestroj');
          return t('Tu máš. A valašku pod kabátom nevyťahuj – handlári sa bijú len o cenu.');
        },
      },
      { label: 'Ešte si to rozmyslím.' },
    ],
  );
}

function hanaDialog(game: Game): DialogNode {
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'hana', text, options);
  const share = ECONOMY.hanaShare;
  if (game.quests.is('c4_rozdel')) {
    return t(
      'Kto je tam? …Ach, cudzí človek. Ja nič nemám, synku – Mastný mi vzal aj posledné vajce. Aj s kurou. Lebo vraj „kura je majetok, z ktorého vajce plynie“.',
      [
        {
          label: `Tu máte, mamko – ${share} dukátov. Rozdajte ich kramárom, čo ich Mastný ožobráčil.`,
          disabled: game.data.dukaty < share,
          action: () => {
            game.data.dukaty -= share;
            game.data.stats.givenToPoor += share;
            game.data.reputation += 8;
            game.sfx('coin', undefined, 0.9);
            game.quests.advance('c4_rozdel');
            return t(line(HANA_THANKS, game.rng));
          },
        },
        { label: 'Hneď sa vrátim.' },
      ],
    );
  }
  if (game.quests.reached('free')) return t('Kramári sa ti klaňajú až po zem, aj keď nevedia komu. Ja to viem. A mlčím.');
  return t('Mastný chodí po jarmoku ako hus po dvore. Len hus aspoň znesie vajce.');
}

/** Pickpocketing the výberca – only from behind, only in disguise. */
function collectorInteractable(game: Game): Interactable {
  return {
    id: 'vyberca-mesec',
    radius: 2.1,
    position: () => game.npcs.get('vyberca')?.position ?? new THREE.Vector3(0, -999, 0),
    label: () => {
      const npc = game.npcs.get('vyberca');
      if (!npc || !npc.model.root.visible || !game.quests.is('c4_vreckuj') || game.town.alarm) return null;
      if (!game.disguised) return 'Výberca – bez prestrojenia sa k nemu nedostaneš';
      return game.behind(npc) ? 'Ukradnúť výbercovi mešec' : 'Výberca ťa vidí – obíď ho zozadu';
    },
    act: () => {
      const npc = game.npcs.get('vyberca');
      if (!npc || !game.disguised || !game.behind(npc)) {
        game.toast('Zozadu, kapitán! Spredu by si mu musel najprv povedať „dobrý deň“.', 'info');
        return;
      }
      game.startMinigame(new PickpocketGame(game.audio), (r) => {
        if (r.won) {
          const got = game.addDukaty(ECONOMY.collectorPurse);
          game.data.flags.c4Stolen = true;
          game.town.theftTimer = 25;
          game.toast(`+${got} dukátov z mešca výbercu! Teraz rýchlo preč z mesta.`, 'good');
          game.quests.advance('c4_vreckuj');
        } else if (!r.aborted) {
          game.bark(npc.model.root, 'Zlodej! Ruky preč od daní!', 3);
          game.raiseTownAlarm();
        }
      });
    },
  };
}

function feroDialog(game: Game): DialogNode {
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'fero', text, options);
  if (game.data.flags.feroBeaten) return t('Už si ma raz položil. Druhý raz si nedám – hanba by ma fackovala až do Ružomberka.');
  return t(`Ty si vraj ten Jánošík? Vsaďme sa o ${ECONOMY.pakaBet} dukátov – kto vyhrá páku, berie všetko!`, [
    {
      label: `Platí! (stávka ${ECONOMY.pakaBet} dukátov)`,
      disabled: game.data.dukaty < ECONOMY.pakaBet,
      action: () => {
        game.startMinigame(new PakaGame({ opponent: 'Ferom', strength: 1.2 * Math.max(0.7, 1 - game.charisma * 0.1), mode: 'paka' }, game.audio), (r) => {
          if (r.aborted) return;
          if (r.won) {
            game.addDukaty(ECONOMY.pakaBet * 2);
            game.data.reputation += 5;
            game.data.flags.feroBeaten = true;
            game.toast('Celý šenk tlieska! Reputácia +5', 'good');
            game.openDialog(t('No… no to snáď nie. Na, ber dukáty. A nikomu ani slovo!'));
          } else {
            game.data.dukaty = Math.max(0, game.data.dukaty - ECONOMY.pakaBet);
            game.openDialog(t('Hahá! Dukáty sem. Príď, keď ti narastú svaly… alebo širší opasok.'));
          }
          game.requestSave();
        });
      },
    },
    { label: 'Inokedy, Fero.' },
  ]);
}

// --------------------------------------------------------------------------- salaš

function bacaDialog(game: Game): DialogNode {
  const q = game.quests;
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'baca', text, options);
  const shop = (): DialogNode =>
    t('Ovce podojené, bryndza zrelá. Čo si vezmeš?', [
      buyOption(game, 'parenica', ITEMS.parenica.price, shop),
      buyOption(game, 'bryndza', ITEMS.bryndza.price, shop),
      { label: 'To stačí.', action: () => main() },
    ]);
  const recipe = (): DialogNode =>
    t(
      'Zemiaky vykop na poli za dedinou, bryndzu máš u mňa a slaninu predá šenkár. S tým všetkým poď k môjmu kotlíku – ale miešať musíš sám, ja mám reumu.\n\nHalušky postavia na nohy celú družinu.',
      [{ label: 'Rozumiem.', action: () => main() }],
    );
  const main = (): DialogNode => {
    const options: DialogOption[] = [];
    if (q.step === 'c2_baca') {
      options.push({
        label: 'Vraj vieš o nejakom panskom koči…',
        action: () => {
          q.advance('c2_baca');
          return t(
            'Psst! Počul som od valacha, že po hradskej pri Váhu pôjde koč zemana Mastnobruchého z Hrádku. Truhlica plná dukátov, čo vydrel z ľudí za robotu na panskom.\n\nPri ceste stojí smrek – uviazal som mu červenú stuhu. Keby ho niekto zoťal, koč by tadiaľ neprešiel… A keď pandúrom zahráš na fujare, zaspia ako ovce po strihaní.',
          );
        },
      });
    }
    if (q.reached('free')) {
      options.push({
        label: 'Nejaký typ na pánov?',
        action: () => {
          if (game.ambush.active) return t('Jeden koč sa už valí po hradskej, synak. Najprv vybav ten.');
          if (game.time < game.tipReadyAt) return t('Zatiaľ nič. Páni sa po poslednom prepade boja vystrčiť nos. Príď neskôr.');
          game.tipReadyAt = game.time + 90;
          const noble = game.spawnFreeCoach();
          return t(`Hej! Valach videl, ako sa po hradskej valí koč – sedí v ňom ${noble}. Bež k padnutému smreku!`);
        },
      });
    }
    options.push({ label: 'Kúpiť syr a bryndzu', action: shop });
    options.push({
      label: 'Povedz nejakú múdrosť, bača.',
      action: () => t(line(BACA_WISDOM, game.rng), [{ label: 'Hlboké… asi.', action: () => main() }]),
    });
    options.push({ label: 'Ako sa robia bryndzové halušky?', action: recipe });
    options.push(bye);
    return t('Vitaj na salaši, synak. Sadni si, oddýchni. Čo ťa privádza?', options);
  };
  return main();
}

function kotlikInteract(game: Game): void {
  const inv = game.data.inventory;
  if (inv.zemiaky < 1 || inv.bryndza < 1 || inv.slanina < 1) {
    game.openDialog({
      speaker: 'Kotlík',
      text: `Na bryndzové halušky treba: zemiaky (máš ${inv.zemiaky}), bryndzu (máš ${inv.bryndza}) a slaninu (máš ${inv.slanina}).`,
    });
    return;
  }
  game.openDialog({
    speaker: 'Kotlík',
    text: 'Voda vrie, slanina sa škvarí. Uvaríš bryndzové halušky?',
    options: [
      {
        label: 'Variť! (minihra)',
        action: () => {
          game.takeItem('zemiaky');
          game.takeItem('bryndza');
          game.takeItem('slanina');
          game.startMinigame(new HaluskyGame(game.audio), (r) => {
            if (r.aborted) {
              game.toast('Halušky sa rozvarili na kašu… aspoň slaninu si zjedol.', 'bad');
              return;
            }
            const portions = r.score > 0.7 ? 2 : 1;
            game.giveItem('halusky', portions);
            game.toast(
              portions === 2 ? 'Halušky ako od starej mamy! +2 porcie' : 'Trochu pripálené, ale jesť sa dajú. +1 porcia',
              'good',
            );
            game.requestSave();
          });
        },
      },
      { label: 'Inokedy.' },
    ],
  });
}

// --------------------------------------------------------------------------- dedina

function kovacDialog(game: Game): DialogNode {
  const eq = game.data.equipment;
  const node = (): DialogNode => {
    const options: DialogOption[] = [];
    if (eq.opasok < 2) {
      const lvl = eq.opasok + 1;
      const price = ECONOMY.opasokPrices[lvl];
      const name = lvl === 1 ? 'Široký opasok s tromi prackami' : 'Kapitánsky opasok so štyrmi prackami';
      options.push({
        label: `${name} – ${price} d (+25 zdravia, mešec ${ECONOMY.baseCapacity + ECONOMY.capacityPerOpasok[lvl]})`,
        disabled: game.data.dukaty < price,
        action: () => {
          if (game.spend(price)) {
            eq.opasok = lvl;
            game.applyEquipment();
            game.player.heal(25);
            game.toast(`${name}! Čím širší opasok, tým väčší chlap.`, 'good');
          }
          return node();
        },
      });
    }
    if (eq.klobuk < 1) {
      options.push({
        label: `Klobúk s orlím pierkom – ${ECONOMY.klobukPrice} d (+charizma pri verbovaní a páke)`,
        disabled: game.data.dukaty < ECONOMY.klobukPrice,
        action: () => {
          if (game.spend(ECONOMY.klobukPrice)) {
            eq.klobuk = 1;
            game.applyEquipment();
            game.toast('Pierko sa vlní vo vetre. Dievčence na dedine sa otáčajú.', 'good');
          }
          return node();
        },
      });
    }
    if (eq.krpce < 1) {
      options.push({
        label: `Krpce z volskej kože – ${ECONOMY.krpcePrice} d (rýchlejší, blato ťa nezdrží)`,
        disabled: game.data.dukaty < ECONOMY.krpcePrice,
        action: () => {
          if (game.spend(ECONOMY.krpcePrice)) {
            eq.krpce = 1;
            game.applyEquipment();
            game.toast('Nové krpce – blato ti je odteraz ukradnuté.', 'good');
          }
          return node();
        },
      });
    }
    const wares = options.length;
    options.push({
      label: 'Čo sa kuje, majster?',
      action: () => talk(game, 'kovac', line(KOVAC_JOKES, game.rng), [{ label: 'Hehe. Späť k obchodu.', action: node }]),
    });
    options.push(bye);
    const text =
      wares > 0
        ? 'Opasky, krpce, klobúky – všetko pre poriadneho zbojníka. Lacno to nebude, železo je drahé a páni berú daň aj z kladiva.'
        : 'Už máš všetko, čo ti môžem ukuť, kapitán. Ešte tak zlatú valašku… ale na tú by si musel prepadnúť samotného cisára.';
    return talk(game, 'kovac', text, options);
  };
  return node();
}

function katarinaDialog(game: Game): DialogNode {
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'katarina', text, options);
  const d = game.data;
  if (d.dukaty <= 0) return t('Pán Boh ti zaplať aj za dobré slovo, synak. Pán nám vzal posledné vrece múky… a kozu tiež.');
  const give = (fraction: number): DialogOption => {
    const amount = Math.max(1, Math.floor(d.dukaty * fraction));
    return {
      label: `Rozdeliť ${amount} dukátov chudobe (${Math.round(fraction * 100)} %)`,
      action: () => {
        d.dukaty -= amount;
        const rep = Math.ceil(amount / 2);
        d.reputation += rep;
        d.stats.givenToPoor += amount;
        game.sfx('coin');
        game.toast(`Chudoba dostala ${amount} dukátov. Reputácia +${rep}`, 'good');
        if (amount >= 20 && game.rng() < 0.6) {
          game.giveItem('parenica');
          game.toast('Katarína ti z vďaky vtisla do ruky parenicu.', 'good');
        }
        game.quests.advance('c3_rozdel');
        game.requestSave();
        return t(
          amount >= 50
            ? 'Ježišmária, toľko peňazí! Celá dedina bude mať čo do hrnca. Nech ťa Pán Boh ochraňuje, Juraj – o tebe sa budú spievať piesne!'
            : 'Pán Boh zaplať, synak. Deti dnes nepôjdu spať hladné.',
        );
      },
    };
  };
  return t('Juraj, ty dobrá duša… Páni nám berú poslednú kôrku. Ak máš čo dať, dedina ti nezabudne.', [
    give(0.25),
    give(0.5),
    give(0.75),
    { label: 'Dnes nie, stará mať.' },
  ]);
}

// --------------------------------------------------------------------------- Jánošíkove diery

/** Zbojnícke chodníky – secret paths between the signposts (unlocked after chapter 5). */
export const CHODNIKY: Record<string, string> = {
  ukryt: 'Zbojnícky úkryt (Horné diery)',
  diery: 'Dolné diery (Ondráš)',
  terchova: 'Terchová',
  vatra: 'Rovná hora',
  dedina: 'Dedina (šenk)',
  mikulas: 'Liptovský Mikuláš (vdova Hana)',
};

function ondrasDialog(game: Game): DialogNode {
  const t = (text: string, options?: DialogOption[]): DialogNode => talk(game, 'ondras', text, options);
  const q = game.quests;
  if (q.is('c5_ondras')) {
    return t(
      'Jánošík? Ten Jánošík? No… myslel som, že budeš vyšší. A že budeš mať aspoň dve valašky.\n\nÚkryt, hovoríš? Hore na Horných dierach je skalný previs, pod ním suchá jaskyňa. Ale cesta vedie cez tri vodopády a po rebríkoch. Prostredný rebrík zlomil minulú zimu medveď. Ten istý medveď, čo teraz v tej jaskyni spí. Volám ho Dunčo. On ma nevolá nijako.\n\nTu máš povraz – rebrík ním zviažeš. A s Dunčom… no, s Dunčom sa dohodni.',
      [
        {
          label: 'Vďaka, Ondráš. S medveďom sa nejako dohodneme.',
          action: () => {
            game.data.flags.rope = true;
            game.toast('Dostal si povraz.', 'good');
            q.advance('c5_ondras');
            return t('Vravel som „dohodni“, nie „pobi“. Dunčo má rád muziku. Ja nie, ale on áno.');
          },
        },
      ],
    );
  }
  if (q.is('c5_vystup', 'c5_medved')) return t('Dunčo má rád muziku – fujaru najmä. Keď sa nahnevá, zas nemá rád nič.');
  return t(line(ONDRAS_TALK, game.rng));
}

/** Climbing up or down one of the gorge ladders. */
function ladderInteractables(game: Game): Interactable[] {
  const list: Interactable[] = [];
  for (const ladder of game.world.ladders) {
    list.push({
      id: `ladder${ladder.index}-up`,
      radius: 2.2,
      position: () => ladder.bottom,
      label: () => {
        if (!game.quests.reached('c5_vystup')) return 'Rebrík – najprv sa poraď s Ondrášom';
        if (ladder.broken) return game.data.flags.rope ? 'Zviazať zlomený rebrík povrazom' : 'Rebrík je zlomený';
        return 'Vyliezť po rebríku';
      },
      act: () => {
        if (!game.quests.reached('c5_vystup')) {
          game.toast('Rebrík vyzerá vratko. Ondráš dolu v rokline vie, ktorý drží.', 'info');
          return;
        }
        if (ladder.broken) {
          if (!game.data.flags.rope) {
            game.toast('Bez povrazu sa to nedá – priečky chýbajú.', 'bad');
            return;
          }
          game.data.flags[`ladder${ladder.index}Fixed`] = true;
          game.world.repairLadder(ladder.index);
          game.sfx('straw', ladder.bottom);
          game.toast('Rebrík je zviazaný. Drží – aspoň zatiaľ.', 'good');
          game.requestSave();
          return;
        }
        game.climbLadder(ladder, true);
      },
    });
    list.push({
      id: `ladder${ladder.index}-down`,
      radius: 2.2,
      position: () => ladder.top,
      label: () => (ladder.broken ? null : 'Zliezť po rebríku dolu'),
      act: () => game.climbLadder(ladder, false),
    });
  }
  return list;
}

/** The three spots of the hideout that the družina furnishes. */
function hideoutInteractables(game: Game): Interactable[] {
  const h = game.world.hideout;
  const spot = (id: 'fire' | 'beds' | 'table', pos: THREE.Vector3, label: string, cost: number, done: string): Interactable => ({
    id: `hideout-${id}`,
    radius: 2.8,
    position: () => pos,
    label: () => (game.quests.is('c5_zariad') && !game.data.flags[`hideout_${id}`] ? label : null),
    act: () => {
      if (cost > 0 && !game.spend(cost)) return;
      game.buildHideout(id);
      game.toast(done, 'good');
    },
  });
  return [
    spot('fire', h.firePos, 'Postaviť ohnisko', 0, 'Ohnisko horí! Dym sa stráca v skalách – nikto ho neuvidí.'),
    spot('beds', h.bedsPos, 'Nastlať lôžka z čečiny', 0, 'Lôžka z čečiny – voňavé, mäkké a pichľavé presne tak akurát.'),
    spot(
      'table',
      h.tablePos,
      `Zbiť stôl a lavice (${ECONOMY.hideoutTablePrice} dukátov – klince od kováča)`,
      ECONOMY.hideoutTablePrice,
      'Zbojnícky stôl! Teraz už chýba len pečená ovca. A tanier.',
    ),
    {
      id: 'hideout-chest',
      radius: 2.4,
      position: () => h.chestPos,
      label: () => (game.data.flags.hideoutReady ? 'Zbojnícka truhlica' : null),
      act: () => game.openDialog(janDialog(game, true)),
    },
    {
      id: 'hideout-sleep',
      radius: 2.6,
      position: () => h.bedsPos,
      label: () => {
        if (!game.data.flags.hideout_beds || game.quests.is('c5_zariad')) return null;
        const hr = game.dayNight.time;
        return hr >= 18 || hr < 5 ? 'Vyspať sa v úkryte do rána' : null;
      },
      act: () => game.sleepUntilMorning(),
    },
  ];
}

function signpostInteractables(game: Game): Interactable[] {
  return Object.entries(game.world.signposts).map(([id, pos]) => ({
    id: `chodnik-${id}`,
    radius: 2.4,
    position: () => pos,
    label: () => (game.data.flags.chodniky ? 'Zbojnícky chodník – kam pôjdeme?' : null),
    act: () =>
      game.openDialog({
        speaker: 'Zbojnícky chodník',
        text: 'Tajné chodníky cez hory, ktoré pozná len družina a pár bačov. Kam pôjdeme?',
        options: [
          ...Object.entries(CHODNIKY)
            .filter(([to]) => to !== id && game.world.signposts[to])
            .map(([to, name]) => ({ label: name, action: () => game.travel(to) })),
          { label: 'Nikam, ešte sa poobzerám.' },
        ],
      }),
  }));
}

/** Brat Ján and his chest – or, with `hideout`, the zbojníci's own chest up in the diery (same stash). */
function janDialog(game: Game, hideout = false): DialogNode {
  const d = game.data;
  const t = (text: string, options?: DialogOption[]): DialogNode =>
    hideout ? { speaker: 'Zbojnícka truhlica', text, options } : talk(game, 'jan', text, options);
  if (!hideout && game.quests.is('c5_jan')) {
    return t(
      'Juraj! Vieš, čo sa o tebe hovorí v Mikuláši? Že si sa premenil na handlára, okradol výbercu a odletel na koze. Pandúri teraz prehľadávajú každú stodolu od Ružomberka po Hrádok. Aj moju.\n\nPotrebuješ úkryt, kde ťa nikto nenájde. Nad Terchovou sú skalné diery – rokliny, kade ani kamzík nechodí. Drevorubač Ondráš tam táborí, ten pozná každý rebrík.',
      [
        {
          label: 'Diery, hovoríš? Idem za Ondrášom.',
          action: () => {
            game.quests.advance('c5_jan');
            return t('Chodník ide z dediny na sever, rovno do rokliny. A Juraj – keď tam stretneš medveďa, pozdravuj ho odo mňa. Z diaľky.');
          },
        },
      ],
    );
  }
  const node = (): DialogNode => {
    const options: DialogOption[] = [
      {
        label: `Ukryť všetko z mešca (${d.dukaty} d)`,
        disabled: d.dukaty <= 0,
        action: () => {
          d.stash += d.dukaty;
          game.toast(`Ukryl si ${d.dukaty} dukátov v truhlici u brata Jána.`, 'good');
          d.dukaty = 0;
          game.sfx('coin');
          game.quests.advance('c3_ukry');
          game.requestSave();
          return node();
        },
      },
      {
        label: 'Vybrať 50 dukátov',
        disabled: d.stash <= 0,
        action: () => {
          const want = Math.min(50, d.stash);
          const got = game.addDukaty(want);
          d.stash -= got;
          game.requestSave();
          return node();
        },
      },
      bye,
    ];
    return t(
      hideout
        ? `Dubová truhlica v skale. Brat Ján ju sem pomohol vyvliecť – vraj už nechce mať doma zbojnícky poklad.\n\nV truhlici je ${d.stash} dukátov.`
        : `Juraj! Mama by plakala, keby vedela… Ale truhlicu ti postrážim, u mňa ju pandúri hľadať nebudú.\n\nV truhlici je ${d.stash} dukátov. Čo, čo sa schová, to sa nestratí – ani keď ťa drábi dolapia.`,
      options,
    );
  };
  return node();
}

/** At night a sleeping villager's door can be knocked on – they come out grumbling. */
function knockAt(game: Game, id: NpcId): Interactable {
  const pools: Partial<Record<NpcId, readonly string[]>> = { kovac: WOKEN_KOVAC, katarina: WOKEN_KATARINA, jan: WOKEN_JAN };
  return {
    id: `door-${id}`,
    radius: 2.4,
    position: () => game.npcs.get(id)?.door ?? new THREE.Vector3(0, -999, 0),
    label: () => {
      const npc = game.npcs.get(id);
      return npc?.asleep ? `Zaklopať na dvere – ${npc.displayName} spí` : null;
    },
    act: () => {
      const npc = game.npcs.get(id);
      if (!npc) return;
      game.sfx('chop', npc.position, 1.4);
      game.scheduler.after(0.25, () => game.sfx('chop', npc.position, 1.5));
      game.scheduler.after(1.2, () => {
        npc.knock(game.world, game.player.position);
        const own = pools[id];
        game.bark(npc.model.root, line(own && game.rng() < 0.6 ? own : WOKEN, game.rng), 4.5);
      });
    },
  };
}

function villagerLine(game: Game): string {
  const rep = game.data.reputation;
  return line(rep >= 40 ? VILLAGER_HIGH : rep >= 10 ? VILLAGER_MID : VILLAGER_LOW, game.rng);
}

// --------------------------------------------------------------------------- registry

export function createInteractables(game: Game): Interactable[] {
  const list: Interactable[] = [
    npcAt(game, 'uhorcik', 3, () => 'Tomáš Uhorčík – hovoriť', () => game.openDialog(uhorcikDialog(game))),
    npcAt(
      game,
      'ilcik',
      2.6,
      () => 'Ilčík – hovoriť',
      () =>
        game.openDialog(
          recruitDialog(
            game,
            'ilcik',
            1.0,
            'Kapitán Jánošík? Hm, o tebe sa už po krčmách spieva. Ale ja idem len za tým, kto ma porazí v páke. Alebo… kto zaplatí rundu borovičky celému šenku.',
            'Ešte potrénuj, kapitán. Moja ruka je ako dubový konár.',
          ),
        ),
    ),
    npcAt(
      game,
      'gajdosik',
      2.6,
      () => 'Gajdošík – hovoriť',
      () =>
        game.openDialog(
          recruitDialog(
            game,
            'gajdosik',
            0.85,
            'Ja ti zahrám na gajdách aj na valaške. Ale páku vyhrať musíš, inak sa nehnem od tohto stola. Alebo rundu, to je tiež argument.',
            'Hehe, slabota. Kým nevyhráš, budem tu sedieť a piť – na tvoj účet by sa mi pilo lepšie.',
          ),
        ),
    ),
    npcAt(game, 'krcmar', 2.8, () => 'Šenkár – kúpiť jedlo a pitie', () => game.openDialog(krcmarDialog(game))),
    npcAt(game, 'fero', 2.6, () => 'Fero Silák – páka o dukáty', () => game.openDialog(feroDialog(game))),
    npcAt(game, 'baca', 3, () => 'Bača Ondrej – hovoriť', () => game.openDialog(bacaDialog(game))),
    npcAt(game, 'kovac', 3, () => 'Kováč Mišo – výbava', () => game.openDialog(kovacDialog(game))),
    npcAt(game, 'katarina', 2.8, () => 'Stará Katarína – rozdeliť korisť', () => game.openDialog(katarinaDialog(game))),
    npcAt(game, 'jan', 2.8, () => 'Brat Ján – truhlica s lupom', () => game.openDialog(janDialog(game))),
    ...(['sedliak1', 'sedliak2'] as const).map((id) =>
      npcAt(
        game,
        id,
        2.4,
        () => `${game.npcs.get(id)?.displayName ?? ''} – prihovoriť sa`,
        () => {
          const npc = game.npcs.get(id);
          if (npc) game.bark(npc.model.root, villagerLine(game), 3.5);
        },
      ),
    ),
    npcAt(
      game,
      'gazdina',
      2.4,
      () => (game.quests.reached('c4_prestroj') && !game.data.flags.hasDisguise ? 'Gazdiná Mara – handlársky kabát' : 'Gazdiná Mara – prihovoriť sa'),
      () => {
        if (game.quests.reached('c4_prestroj') && !game.data.flags.hasDisguise) {
          game.openDialog(maraDialog(game));
          return;
        }
        const npc = game.npcs.get('gazdina');
        if (npc) game.bark(npc.model.root, villagerLine(game), 3.5);
      },
    ),
    // Liptovský Mikuláš
    ...(['kramar1', 'kramar2', 'kramar3', 'kramar4'] as const).map((id) =>
      npcAt(game, id, 2.6, () => `${game.npcs.get(id)?.displayName ?? ''} – prihovoriť sa`, () => {
        const npc = game.npcs.get(id);
        if (npc) game.bark(npc.model.root, line(KRAMAR_TALK, game.rng), 4.5);
      }),
    ),
    ...(['mestan1', 'mestan2'] as const).map((id) =>
      npcAt(game, id, 2.4, () => `${game.npcs.get(id)?.displayName ?? ''} – prihovoriť sa`, () => {
        const npc = game.npcs.get(id);
        if (npc) game.bark(npc.model.root, line(MESTAN_TALK, game.rng), 4.5);
      }),
    ),
    npcAt(game, 'hostinsky', 2.8, () => 'Hostinský Kubo – jedlo a nocľah', () => game.openDialog(hostinskyDialog(game))),
    npcAt(game, 'hana', 2.6, () => 'Vdova Hana – hovoriť', () => game.openDialog(hanaDialog(game))),
    collectorInteractable(game),
    // Jánošíkove diery
    npcAt(game, 'ondras', 2.8, () => 'Drevorubač Ondráš – hovoriť', () => game.openDialog(ondrasDialog(game))),
    ...ladderInteractables(game),
    ...hideoutInteractables(game),
    ...signpostInteractables(game),
    {
      id: 'plagat',
      radius: 2.4,
      position: () => game.world.posterPos,
      label: () => 'Plagát na radnici – prečítať',
      act: () => game.openDialog({ speaker: 'Plagát na radnici', text: POSTER_TEXT }),
    },
    ...(['kramar1', 'kramar2', 'kramar3', 'kramar4', 'mestan1', 'mestan2', 'vyberca', 'hana'] as const).map((id) => knockAt(game, id)),
    npcAt(game, 'ponocny', 2.6, () => 'Ponocný Ignác – prihovoriť sa', () => {
      const npc = game.npcs.get('ponocny');
      if (npc) game.bark(npc.model.root, line(PONOCNY_TALK, game.rng), 4.5);
    }),
    ...(['kovac', 'katarina', 'jan', 'sedliak1', 'sedliak2', 'gazdina'] as const).map((id) => knockAt(game, id)),
    {
      id: 'kotlik',
      radius: 2.6,
      position: () => game.world.kotlikPos,
      label: () => 'Kotlík – variť bryndzové halušky',
      act: () => kotlikInteract(game),
    },
    {
      id: 'field',
      radius: 6,
      position: () => game.world.fieldPos,
      label: () => (game.time >= game.fieldReadyAt ? 'Vykopať zemiaky' : null),
      act: () => {
        game.fieldReadyAt = game.time + 40;
        game.giveItem('zemiaky', 2);
        game.sfx('eat');
        game.toast('Vykopal si 2 zemiaky. Majiteľ poľa sa tvári, že nič nevidel.', 'good');
      },
    },
    {
      id: 'chest',
      radius: 2.4,
      position: () => game.world.chestPos,
      label: () => 'Truhlica brata Jána',
      act: () => game.openDialog(janDialog(game)),
    },
    {
      id: 'coach',
      radius: 4.2,
      position: () => game.ambush.coach?.position ?? new THREE.Vector3(0, -999, 0),
      label: () => (game.ambush.lootable ? 'Panský koč – vyžmýkať zemana' : null),
      act: () => {
        const noble = game.ambush.showNoble();
        const name = game.ambush.nobleName;
        const speaker = name.charAt(0).toUpperCase() + name.slice(1);
        if (noble) noble.talking = true;
        const end = (text: string): DialogNode => {
          if (noble) noble.talking = false;
          return { speaker, text };
        };
        game.openDialog({
          speaker,
          text: line(ZEMAN_PLEA, game.rng),
          options: [
            {
              label: 'Dukáty sem, Vaša Milosť!',
              action: () => {
                game.lootCoach(0);
                return end(line(ZEMAN_AFTER, game.rng));
              },
            },
            {
              label: 'A ten zlatý retiazok z bruška tiež.',
              action: () => {
                game.lootCoach(20);
                game.data.reputation += 2;
                return end('Môj retiazok?! Ten mi daroval sám palatín! … Áno, áno, beriem späť, nech sa páči.');
              },
            },
          ],
        });
      },
    },
  ];
  return list;
}

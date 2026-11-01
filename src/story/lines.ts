import type { CompanionId } from '@/types/game-types';

/** Random pick from a pool of lines. */
export function line(pool: readonly string[], rng: () => number = Math.random): string {
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

// ---------------------------------------------------------------- družina po ceste

export const BANTER: Record<CompanionId, readonly string[]> = {
  uhorcik: [
    'Za mojich čias sme zbojníčili bez máp. Aj bez topánok. A do kopca oboma smermi.',
    'Kapitán, ty kráčaš, akoby si mal v krpci kamienok. Alebo dva.',
    'Moja stará vraví, že zbojníctvo nie je robota. Tak som jej doniesol dukáty. Odvtedy nevraví nič.',
    'Ešte raz začne Gajdošík pískať, a jeho gajdy skončia v Váhu.',
    'Keď som bol mladý, preskočil som vatru aj s kozou na pleciach. Koza to dodnes rozpráva.',
    'Pandúr je ako komár. Veľa bzučí a najviac ho je v lete.',
  ],
  ilcik: [
    'Kapitán, keby si potreboval, ja zdvihnem aj voz. Aj s volom. Aj s pánom na voze.',
    'Videl si, ako som toho pandúra minule? Ani ja som to nevidel, tak rýchlo som to spravil.',
    'Raz som vyhral páku s medveďom. Teda… on si to tak nepamätá.',
    'Od tých halušiek mám silu ako tri kone. A aj podobne voniam.',
    'Kto vymyslel kopce? Nech mi ho ukážu, poviem mu svoje.',
  ],
  gajdosik: [
    'Kapitán, zložil som o tebe pieseň. Rýmuje sa na „opasok“ len „kopa sok“. Ešte na tom robím.',
    'Keby páni platili za muziku toľko ako za kone, bol by zo mňa gróf.',
    'Viete, prečo pandúri nosia také vysoké čiapky? Aby tam schovali rozum. Je ho málo, zmestí sa.',
    'Hmm-hmm-hmmm… nevadí, keď si pobrumkám? Nie? Tak si pobrumkám nahlas.',
    'Uhorčík vraví, že som falošný. Ja vravím, že som avantgardný.',
  ],
};

export const BANTER_NIGHT: readonly string[] = [
  'Tma ako v pandúrskej hlave. Svieť si pod nohy, kapitán.',
  'V noci sa najlepšie zbojníči. Aj sa najlepšie spí. Ťažká voľba.',
  'Počuli ste tú sovu? Alebo to bol Ilčíkov žalúdok?',
  'Mesiac svieti ako zemanova pleš.',
];

export const BANTER_RAIN: readonly string[] = [
  'Leje ako z krhly. Aspoň sa konečne umyjeme.',
  'Moje onuce sú mokré až po dušu.',
  'V takom daždi ani pandúr nevystrčí nos. Ideálne počasie na prepad!',
  'Keby za každú kvapku bol dukát, kúpime celý Liptov.',
];

export const BANTER_MUD: readonly string[] = [
  'Blato po kolená. Krpce sa mi tu rozlúčia so mnou.',
  'Toto blato by si mal zdaniť zeman, keď už zdaňuje všetko ostatné.',
  'Kapitán, ak tu uviaznem, povedz mojej mame, že som zahynul hrdinsky. Nie v blate.',
];

export const BANTER_HURT: readonly string[] = [
  'Kapitán, vyzeráš ako parenica po trhu. Daj si niečo zjesť.',
  'Krvácaš na môj nový opasok… Zjedz slaninu, prosím ťa.',
];

export const AFTER_FIGHT: readonly string[] = [
  'Hej-hou! Ešte zopár takých a pandúri budú chodiť len vo dvojiciach. Za ruky.',
  'To bolo rýchle. Rýchlejšie, ako Gajdošík zahrá jednu pieseň.',
  'Ani som sa nezapotil. Teda… trošku. Na chrbte. A pod pazuchou.',
  'Nech si to páni zapíšu: Liptov nie je ich!',
  'Dobrá robota, chlapci. Kto platí borovičku?',
];

// ---------------------------------------------------------------- pandúri

export const PANDUR_LOG: readonly string[] = [
  'Čo to má byť?! Strom na ceste!',
  'Kto tu zase zvalil smrek? Bobry? Na Liptove?',
  'Zastaviť! Strom! Opakujem: STROM!',
];

export const PANDUR_ALERT: readonly string[] = [
  'Zbojníci! Do zbrane!',
  'Jánošík! Mama, ja chcem domov!',
  'Stáť! V mene stoličného slúžneho… a jeho svokry!',
  'Pozor, sú tu! A je ich viac ako nás! …To nie je fér!',
];

export const PANDUR_HIT: readonly string[] = [
  'Au! To bol môj dobrý zub!',
  'Moja čiapka! Stála tri zlatky!',
  'Toto si zapíšem do hlásenia!',
  'Ej, to nebolo podľa predpisov!',
  'Mamííí!',
];

export const PANDUR_DOWN: readonly string[] = [
  'Ja… si tu len… chvíľu poležím…',
  'Povedzte grófovi… že mi nezaplatil dosť…',
  'Ďalší rok idem radšej za pastiera…',
  'Ja som tu bol len na brigáde…',
];

export const PANDUR_SLEEP: readonly string[] = [
  'Zzz… tá fujara… zzz',
  'Mamička… ešte päť minút… zzz',
  'Zzz… halušky… s dvojitou slaninou… zzz',
];

export const PANDUR_WAKE: readonly string[] = [
  'Hm?! Čo… kto… nespal som!',
  'Neviem nič, nič som nevidel, spal som služobne!',
];

// ---------------------------------------------------------------- dedinčania

export const VILLAGER_LOW: readonly string[] = [
  'Ďalší zbojník… len aby si nám nepriniesol pandúrov na krk.',
  'Mám len dve kozy a tie ti nedám. Jedna hryzie a druhá je ešte horšia.',
  'Hmla ako mlieko. V takom počasí ani pes nevystrčí nos.',
  'Zeman nám zvýšil daň z komína. Tak už ani nekúrime. Aspoň neplatíme.',
  'Vraj si Jánošík. Ja som zas cisár. Teší ma.',
];

export const VILLAGER_MID: readonly string[] = [
  'Vraj si dal Kataríne dukáty. Pekne od teba.',
  'Panskí drábi ťa hľadajú. Ja som ťa nevidel. Ani teraz ťa nevidím.',
  'Na hradskej je blato po kolená, daj si pozor.',
  'Moja žena chce vedieť, či si ženatý. Pýtam sa pre kamaráta.',
];

export const VILLAGER_HIGH: readonly string[] = [
  'To je on! Jánošík! Nech ti Boh žehná, kapitán!',
  'Moja Anička o tebe spieva celé dni. Aj v noci. Nespíme.',
  'Pre teba vždy otvorím dvere aj komoru. Aj pivnicu, ak sa nikto nepozerá.',
  'Keď vyrastiem, budem zbojník ako ty! …Áno, mám štyridsať rokov, ale čo už.',
];

export const VILLAGER_WAVE: readonly string[] = [
  'Aj ja ti mávam! Ale opatrne, aby ma nevideli drábi.',
  'Ahoj, kapitán! Pekný opasok!',
  'Mávaš ako môj nebohý svokor. Tiež bol zbojník. Teda… kradol slivky.',
];

export const VILLAGER_DANCE: readonly string[] = [
  'Hej, to je odzemok! Ako za mlada!',
  'Hopsa! Taký tanec som nevidel od svadby môjho deda!',
  'Jaj, len aby si si neroztrhol nohavice!',
  'Toto keby videl zeman, od závisti by zjedol vlastnú parochňu!',
];

export const VILLAGER_LAUGH: readonly string[] = [
  'Čomu sa smeješ? …Mne? Hej, ja mám pekný klobúk!',
  'Smiech je zdravý. Hovoril to aj môj dedo, kým sa nezadusil hruškou.',
];

// ---------------------------------------------------------------- páni a remeselníci

export const ZEMAN_PLEA: readonly string[] = [
  'Ó, pán zbojník, ja som len chudobný zeman! Doma mám deväť hladných psov, tri hladné grófky a jedného veľmi hladného hajdúcha…',
  'Prosím, nie do tváre! Tú som si nechal maľovať v Benátkach!',
  'Viete vy, kto som ja?! …Nie? Výborne, tak ma tu ani nebolo.',
  'Peniaze? Aké peniaze? Toto sú… cestovné kamene. Na zaťaženie koča. Vo vetre.',
];

export const ZEMAN_AFTER: readonly string[] = [
  'Toto bude mať dohru u stoličného súdu! … Ehm, teda… pekný deň prajem, páni zbojníci.',
  'Napíšem sťažnosť! Hneď ako sa naučím písať.',
  'Moja mamička sa to dozvie! Tá vám dá!',
  'Dobre teda. Ale parochňu si nechávam. Bez nej som len ďalší plešatý chlap.',
];

export const KRCMAR_GOSSIP: readonly string[] = [
  'Vraj zeman z Hrádku dal postaviť záchod zo zlata. Ešte ho nepoužil, bojí sa, že mu ho ukradneš.',
  'Fero Silák sa chváli, že vyhrá páku aj s tebou. Včera prehral s vlastnou ženou.',
  'Bača Ondrej predal pandúrovi bryndzu. Pandúr potom tri dni nevyšiel zo strážnice. Vraj náhoda.',
  'Pandúri teraz chodia vo štvoriciach. Traja na stráž a štvrtý, čo im vysvetľuje, kde je les.',
  'Gróf Pivnicový vraj vie po latinsky. Ale len slovo „daň“.',
];

export const BACA_WISDOM: readonly string[] = [
  'Ovca, čo blúdi, nájde vlka. Pán, čo blúdi, nájde teba. Hehe.',
  'Bryndza je ako dobrý zbojník: čím je staršia, tým viac smrdí a tým je lepšia.',
  'Keď sa vatra rozhorí, netreba ju fúkať. Keď sa rozhorí zeman, treba ho ovaliť.',
  'Hmla nad Liptovom je ako pandúrsky rozum – hustá, sivá a nikto nevie, čo v nej je.',
];

export const KOVAC_JOKES: readonly string[] = [
  'Pandúrom kujem meče z najhoršieho železa. Za tie peniaze nič lepšie nedostanú.',
  'Kováč má vždy pravdu. Lebo má kladivo.',
  'Raz som ukul zemanovi brnenie. Musel som ho trikrát prerábať – vždy, keď sa naobedoval.',
];

// ---------------------------------------------------------------- noc v dedine

/** Somebody knocked them out of bed. */
export const WOKEN: readonly string[] = [
  'Kto to búcha o takomto čase?! …Ach, Jánošík. No čo už, poď.',
  'Ak horí, tak hasím. Ak nehorí, tak ťa zabijem. …Nehorí? Tak čo chceš?',
  'Práve sa mi snívalo o pečenej kačke. A ty si mi ju zjedol, kapitán.',
  'V nočnej košeli sa so zbojníkmi nerozprávam. …No tak dobre, ale rýchlo.',
  'Pšš! Žena spí. Ak ju zobudíš, bude to horšie ako pandúri.',
  'Že vraj zbojníci chodia v noci. Ale prečo práve ku mne?',
];

export const WOKEN_KOVAC: readonly string[] = [
  'Vyhňa je studená, ja som ešte studenší. Ale pre teba niečo nájdem.',
  'Kto ma budí, tomu kujem podkovy naopak. …Ty si výnimka, kapitán.',
];

export const WOKEN_KATARINA: readonly string[] = [
  'Juraj, chlapče! Že sa ti nechce spať… Ale stará Katarína nespí nikdy celkom.',
  'Myslela som, že je to smrtka. Ty si krajší, ale klopeš rovnako.',
];

export const WOKEN_JAN: readonly string[] = [
  'Brat môj, nemohol si prísť cez deň ako normálny človek? …Ach, áno. Nie si normálny človek.',
  'Mama by ma zabila, keby vedela, že ti v noci otváram. Poď dnu, kým ťa niekto zbadá.',
];

/** Ponocný calls out the hour – {h} is replaced with the hour name. */
export const PONOCNY_CALL: readonly string[] = [
  'Chváľte Pána Boha, odbila {h}! Chráňte oheň i svetlo!',
  'Počujte, ľudia, odbila {h}! Kto nespí, nech aspoň nechrápe!',
  'Odbila {h}! Kuriatka do kurína, zbojníci do… ehm, dobrú noc!',
  'Odbila {h}! Všetko pokojné – až na Ďurkov šenk.',
];

export const PONOCNY_TALK: readonly string[] = [
  'Ja nič nevidím, kapitán. Ja som ponocný – ja len počítam hodiny.',
  'Tridsať rokov chodím po dedine v noci. Ešte som nestretol strašidlo. Len teba.',
  'Keď uvidím pandúra, zatrúbim trikrát. Keď uvidím teba, zakašlem a pozriem sa inam.',
  'Lampáš mi dala obec. Olej si kupujem sám. Taká je to služba.',
  'V noci počuť všetko – kto chrápe, kto sa háda, kto kradne slaninu z komory. To posledné bol Gajdošík.',
];

export const HOUR_NAMES = [
  'polnoc', 'jedna', 'druhá', 'tretia', 'štvrtá', 'piata', 'šiesta', 'siedma', 'ôsma', 'deviata', 'desiata', 'jedenásta',
] as const;

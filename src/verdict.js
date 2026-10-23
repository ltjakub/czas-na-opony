import { fmtTemp } from './util.js';

export const THRESHOLD = 7; // °C, średnia dobowa (reguła podawana m.in. przez PZPO)

/**
 * Ocena na podstawie 7 najbliższych pełnych dób.
 * status: 'now' (rób wymianę) | 'soon' (umów termin) | 'wait' (czekaj)
 * To heurystyka informacyjna, a nie przepis prawa.
 */
export function evaluate(days, mode) {
  const d = days.slice(0, 7);
  const n = d.length;
  if (n < 6) throw new Error('za mało dni prognozy');
  const means = d.map((x) => x.mean);
  const mins = d.map((x) => x.min);
  const below = means.filter((m) => m < THRESHOLD).length;
  const above = n - below;
  const frostNights = d.filter((x) => x.min <= 0).length;
  const coldest = Math.min(...mins);
  const min3 = Math.min(...mins.slice(0, 3));
  const stats = { n, below, above, frostNights, coldest };

  let status;
  if (mode === 'zimowe') {
    if (below >= 5 || (below >= 3 && min3 <= 0)) status = 'now';
    else if (below >= 2 || min3 <= 2) status = 'soon';
    else status = 'wait';
  } else {
    if (above >= 6 && frostNights === 0) status = 'now';
    else if (above >= 4 && frostNights <= 1) status = 'soon';
    else status = 'wait';
  }

  const HEAD = {
    zimowe: {
      now: 'Tak, czas założyć zimówki',
      soon: 'Jeszcze chwila, ale umów już wymianę',
      wait: 'Jeszcze nie, poczekaj z wymianą',
    },
    letnie: {
      now: 'Tak, czas na opony letnie',
      soon: 'Prawie, umów wymianę na najbliższe dni',
      wait: 'Jeszcze nie, zimówki zostają',
    },
  };
  const NEXT = {
    zimowe: {
      now: 'Umów wymianę jak najszybciej, bo przy pierwszych chłodach w warsztatach robią się kolejki.',
      soon: 'Zarezerwuj termin w warsztacie, zanim spadnie pierwszy śnieg i zrobi się tłok.',
      wait: 'Sprawdź prognozę ponownie za kilka dni. Zimówki zakładane za wcześnie szybciej się ścierają w cieplejsze dni.',
    },
    letnie: {
      now: 'Temperatury są stabilne. To dobry moment na wymianę.',
      soon: 'Zarezerwuj termin, ale pilnuj nocy: letnie opony słabiej trzymają przy przymrozkach.',
      wait: 'Poczekaj na stabilne ciepło. Letnie opony przy temperaturach bliskich zera słabiej trzymają nawierzchnię.',
    },
  };

  const frost = frostNights > 0 ? ` Przymrozki prognozowane są w ${frostNights} z ${n} nocy.` : '';
  const lead =
    mode === 'zimowe'
      ? `Średnia dobowa ma być poniżej ${THRESHOLD}°C w ${below} z ${n} najbliższych dni, a najzimniejsza noc to ${fmtTemp(coldest)}°C.${frost}`
      : `Średnia dobowa ma wynosić co najmniej ${THRESHOLD}°C w ${above} z ${n} najbliższych dni, a najzimniejsza noc to ${fmtTemp(coldest)}°C.${frost}`;

  return { status, headline: HEAD[mode][status], lead, next: NEXT[mode][status], stats };
}

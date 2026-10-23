export const TZ = 'Europe/Warsaw';

// Formattery tworzymy raz (tworzenie Intl.DateTimeFormat jest drogie, a budżet CPU w planie darmowym to 10 ms).
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const WD_FMT = new Intl.DateTimeFormat('pl-PL', { timeZone: 'UTC', weekday: 'short' });
const STAMP_FMT = new Intl.DateTimeFormat('pl-PL', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** 'YYYY-MM-DD' w strefie Europe/Warsaw */
export const dayKey = (d = new Date()) => DAY_FMT.format(d);

export function dayLabel(key) {
  const d = new Date(`${key}T12:00:00Z`);
  const [, m, dd] = key.split('-');
  return { wd: WD_FMT.format(d).replace('.', ''), date: `${dd}.${m}` };
}

export const stamp = (ms) => STAMP_FMT.format(new Date(ms));

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 6,8  /  −2,3  (przecinek dziesiętny, typograficzny minus) */
export function fmtTemp(t) {
  const r = Math.round(t * 10) / 10;
  if (Math.abs(r) < 0.05) return '0,0';
  return r.toFixed(1).replace('.', ',').replace('-', '\u2212');
}

// Dwa tryby: wymiana na zimowe (jesień) i na letnie (wiosna).
export const MODES = {
  zimowe: { key: 'zimowe', path: '/zmiana-opon-na-zimowe', label: 'na zimowe', adj: 'zimowe', gen: 'zimowych', other: 'letnie', season: [9, 12] },
  letnie: { key: 'letnie', path: '/zmiana-opon-na-letnie', label: 'na letnie', adj: 'letnie', gen: 'letnich', other: 'zimowe', season: [2, 5] },
};

const monthOf = (date) => Number(dayKey(date).slice(5, 7));

/** Który tryb pokazywać jako domyślny na stronie głównej (najbliższy szczyt sezonu). */
export function defaultMode(date = new Date()) {
  const m = monthOf(date);
  return m >= 8 && m <= 12 ? 'zimowe' : 'letnie';
}

/** Czy teraz jest typowy sezon na tę wymianę (wrzesień–grudzień / luty–maj). */
export function inSeason(mode, date = new Date()) {
  const m = monthOf(date);
  const [a, b] = MODES[mode].season;
  return m >= a && m <= b;
}

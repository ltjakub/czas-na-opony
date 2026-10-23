// ---------------------------------------------------------------------------
// MIEJSCE POD AFILIACJĘ
//
// Każdy wpis to jeden sklep partnerski. Link ustawiasz BEZ zmiany kodu:
// wrangler.toml -> [vars] albo Cloudflare Dashboard -> Workers -> Settings -> Variables.
//   AFF_TIRENDO_URL     = "https://www.awin1.com/cread.php?awinmid=...&awinaffid=...&ued=..."
//   AFF_OPONYTANIO_URL  = "https://..."
//
// Dopóki zmienna jest pusta (lub nie zaczyna się od https://), blok z ofertą
// w ogóle się nie renderuje. Nowy sklep = nowy wpis poniżej + nowa zmienna.
//
// Linki w HTML prowadzą do /go/<id>, które robi redirect 302 na Twój link partnerski
// (pozwala podmieniać linki w jednym miejscu i widzieć kliknięcia w logach Workera).
// Sprawdź regulamin danego programu, czy dopuszcza przekierowanie przez własną domenę.
// ---------------------------------------------------------------------------
export const AFFILIATES = [
  { id: 'tirendo', name: 'Tirendo', envKey: 'AFF_TIRENDO_URL' },
  { id: 'oponytanio', name: 'Oponytanio.pl', envKey: 'AFF_OPONYTANIO_URL' },
];

export function activeAffiliates(env) {
  return AFFILIATES.filter((a) => typeof env[a.envKey] === 'string' && /^https:\/\//.test(env[a.envKey]));
}

export function findAffiliate(env, id) {
  return activeAffiliates(env).find((a) => a.id === id) || null;
}

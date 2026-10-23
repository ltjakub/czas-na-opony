// Lista miast. Celowo krótka (19 pozycji): każda strona miasta ma własne, realne dane
// prognostyczne, ale tysiące niemal identycznych stron to ryzyko "scaled content abuse".
// `loc` = forma miejscownika z przyimkiem (używana w nagłówkach).
// `alt` (opcjonalnie) = wysokość n.p.m. w metrach, tylko tam, gdzie model terenu może mylić (góry).
export const CITIES = [
  { slug: 'bialystok', name: 'Białystok', loc: 'w Białymstoku', lat: 53.1325, lon: 23.1688 },
  { slug: 'bydgoszcz', name: 'Bydgoszcz', loc: 'w Bydgoszczy', lat: 53.1235, lon: 18.0084 },
  { slug: 'gdansk', name: 'Gdańsk', loc: 'w Gdańsku', lat: 54.352, lon: 18.6466 },
  { slug: 'gorzow-wielkopolski', name: 'Gorzów Wielkopolski', loc: 'w Gorzowie Wielkopolskim', lat: 52.7368, lon: 15.2288 },
  { slug: 'katowice', name: 'Katowice', loc: 'w Katowicach', lat: 50.2649, lon: 19.0238 },
  { slug: 'kielce', name: 'Kielce', loc: 'w Kielcach', lat: 50.8661, lon: 20.6286 },
  { slug: 'krakow', name: 'Kraków', loc: 'w Krakowie', lat: 50.0647, lon: 19.945 },
  { slug: 'lublin', name: 'Lublin', loc: 'w Lublinie', lat: 51.2465, lon: 22.5684 },
  { slug: 'lodz', name: 'Łódź', loc: 'w Łodzi', lat: 51.7592, lon: 19.456 },
  { slug: 'olsztyn', name: 'Olsztyn', loc: 'w Olsztynie', lat: 53.7784, lon: 20.4801 },
  { slug: 'opole', name: 'Opole', loc: 'w Opolu', lat: 50.6751, lon: 17.9213 },
  { slug: 'poznan', name: 'Poznań', loc: 'w Poznaniu', lat: 52.4064, lon: 16.9252 },
  { slug: 'rzeszow', name: 'Rzeszów', loc: 'w Rzeszowie', lat: 50.0413, lon: 21.999 },
  { slug: 'suwalki', name: 'Suwałki', loc: 'w Suwałkach', lat: 54.1118, lon: 22.9309 },
  { slug: 'szczecin', name: 'Szczecin', loc: 'w Szczecinie', lat: 53.4285, lon: 14.5528 },
  { slug: 'warszawa', name: 'Warszawa', loc: 'w Warszawie', lat: 52.2297, lon: 21.0122 },
  { slug: 'wroclaw', name: 'Wrocław', loc: 'we Wrocławiu', lat: 51.1079, lon: 17.0385 },
  { slug: 'zakopane', name: 'Zakopane', loc: 'w Zakopanem', lat: 49.2992, lon: 19.9496, alt: 840 },
  { slug: 'zielona-gora', name: 'Zielona Góra', loc: 'w Zielonej Górze', lat: 51.9356, lon: 15.5062 },
];

export const CITY_BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));

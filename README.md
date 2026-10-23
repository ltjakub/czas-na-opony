# Czas na opony

Strona "Czy już zmienić opony?" na Cloudflare Workers (plan darmowy). Bez frameworka i bez JS po stronie klienta.
Dla wybranego miasta pobiera prognozę z MET Norway, liczy średnią dobową na 7 dni i porównuje ją z progiem 7°C.
19 miast × 2 tryby (na zimowe / na letnie) = 38 stron + strona główna, 2 huby, polityka prywatności, sitemap, robots.

## Wdrożenie (ok. 10 minut)

```bash
npm install
npx wrangler login
# 1. W wrangler.toml ustaw SITE_URL i CONTACT_EMAIL (kontakt trafia do User-Agenta, wymaga tego MET Norway)
npm test            # testy z atrapą MET
npm run dev         # podgląd lokalny
npm run deploy
```

**Własna domena (ważne):** dodaj domenę do Cloudflare (plan Free) i odkomentuj `routes` w `wrangler.toml`.
Na `*.workers.dev` nie działa Cache API, więc strony nie są cache'owane na edge (działa tylko cache w pamięci isolate'a).
Po podpięciu domeny zmień `SITE_URL` na docelowy adres, bo trafia do canonical, sitemapy i JSON-LD.

## Afiliacja

Dostępność dla każdego: tak, bez negocjacji, ale w dwóch krokach.
1. **Rejestracja w sieci** (np. Awin): formularz publishera, drobna zwrotna opłata weryfikacyjna, brak negocjacji.
2. **Zgoda każdego sklepu osobno**: w panelu Awin wybierasz program (np. Tirendo PL, Oponytanio) i klikasz "Join". Decyduje reklamodawca,
   zwykle do ok. 10 dni roboczych. Dlatego najpierw wdróż stronę, bo reklamodawca ocenia działającą witrynę.
   Stawki negocjuje się dopiero później, przy dużym ruchu (osobna rozmowa z opiekunem programu).

Po akceptacji wklej link partnerski (deeplink) do zmiennej `AFF_TIRENDO_URL` / `AFF_OPONYTANIO_URL`
(wrangler.toml lub Dashboard → Workers → Settings → Variables). Bez kodu: blok z ofertą pojawi się sam na wszystkich stronach.
- Linki mają `rel="sponsored nofollow"` i oznaczenie, że są partnerskie (wymóg przejrzystości).
- Wewnętrznie linki idą przez `/go/<id>` (redirect 302). Dla Awin dopisywany jest `clickref` z nazwą strony, więc w panelu zobaczysz, które miasta sprzedają.
- Nowy sklep: dopisz wpis w `src/config.js` i zmienną w `wrangler.toml`.
- Sprawdź regulamin programu, czy dopuszcza przekierowanie przez własną domenę.

## SEO: co jest zrobione
Title i description per strona (z aktualnym werdyktem), canonical, jeden H1, breadcrumbs + JSON-LD, sitemap, robots (blokuje /szukaj i /go/),
brak ukośnika końcowego (301), noindex na 404/503, wykres SVG + tabela tekstowa, SSR bez JS, inline CSS, systemowe fonty, tryb ciemny, CSP bez skryptów.

## Czego NIE robić (lekcja z METAR)
Nie dodawaj setek miast "bo się da". Każda strona ma własne dane prognozy, ale tekst jest szablonowy, a Google karze skalowane,
mało unikalne strony. Rozszerzaj o kolejne miasta stopniowo i tylko, gdy Search Console pokazuje, że obecne strony są indeksowane i mają wyświetlenia.

## Po wdrożeniu
1. Search Console: dodaj domenę, wyślij `/sitemap.xml`, poproś o indeksację strony głównej i 2 hubów.
2. Cloudflare → Web Analytics → skopiuj token do `CF_BEACON_TOKEN` (pomiar bez cookies).
3. Dashboard → Workers → Metrics: sprawdź CPU time (limit planu darmowego: 10 ms) i liczbę żądań (100 tys./dobę).
4. Zweryfikuj aktualne warunki: MET Norway (api.met.no/doc/TermsOfService) i programy afiliacyjne.

## Znane ograniczenia
- Reguły werdyktu (`src/verdict.js`) to heurystyka oparta na progu 7°C; progi "umów termin" są moje, popraw je według własnej oceny.
- Współrzędne miast są przybliżone (centrum). Zakopane ma ustawioną wysokość 840 m n.p.m.
- Dalsze dni prognozy są mniej pewne; średnie dobowe liczone z punktów 1-godzinnych i 6-godzinnych.
- Polityka prywatności to szablon do dostosowania.
# test

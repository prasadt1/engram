# Seed photo attributions

`scripts/seed_demo_user.py` seeds `demo-user`'s journey with 16 photos
sourced from Unsplash, hotlinked via `https://images.unsplash.com/photo-<id>?w=1200&q=80`.
[Unsplash's license](https://unsplash.com/license) permits this use without
requiring attribution — the list below is included as good practice, and as
a verifiable manifest of exactly which images the seed uses.

**Attribution note:** photographer usernames could not be reliably resolved
for this list. Unsplash's canonical photo pages require a title-slug prefix
before the photo ID (`unsplash.com/photos/<slug>-<id>`); fetching the bare
`unsplash.com/photos/<id>` URL returns "Page not found," and the Unsplash
API (which would return photographer credit directly) requires an
Application ID that wasn't set up for this hackathon. Rather than invent a
photographer name, each entry below is credited generically as "Unsplash
contributor" with the photo ID and a direct CDN source link, so the actual
image is always independently verifiable.

Every ID below was verified by direct download before being locked into the
manifest (HTTP 200, `image/jpeg`, > 30KB).

## Session 1 — day −21 (establishing shots, weakest session)

| Genre | Attribution | Source |
|---|---|---|
| Landscape | Unsplash contributor — misty field at sunrise, horizon line | https://images.unsplash.com/photo-1470252649378-9c29740c9fa8 |
| Landscape | Unsplash contributor — forest path with sunbeams | https://images.unsplash.com/photo-1441974231531-c6227db76b6e |
| Portrait | Unsplash contributor — outdoor portrait, natural light | https://images.unsplash.com/photo-1500648767791-00dcc994a43e |

## Session 2 — day −16 (composition still below bar)

| Genre | Attribution | Source |
|---|---|---|
| Landscape | Unsplash contributor — close-up ocean wave, clean horizon | https://images.unsplash.com/photo-1518837695005-2083093ee35b |
| Still life | Unsplash contributor — breakfast bowl flatlay with flowers | https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea |
| Portrait | Unsplash contributor — close-up studio portrait | https://images.unsplash.com/photo-1531123897727-8f129e1688ce |
| Architecture | Unsplash contributor — skyscrapers from street level | https://images.unsplash.com/photo-1486406146926-c627a92ad1ab |

## Session 3 — day −11 (composition crosses the bar; streak 1)

| Genre | Attribution | Source |
|---|---|---|
| Landscape | Unsplash contributor — mountains above a cloud sea at sunrise, horizon | https://images.unsplash.com/photo-1506905925346-21bda4d32df4 |
| Architecture | Unsplash contributor — city avenue, converging perspective | https://images.unsplash.com/photo-1449824913935-59a10b8d2000 |
| Still life | Unsplash contributor — sliced fruit platter | https://images.unsplash.com/photo-1490645935967-10de6ba17061 |

## Session 4 — day −6 (composition streak 2)

| Genre | Attribution | Source |
|---|---|---|
| Landscape | Unsplash contributor — footbridge through dense forest | https://images.unsplash.com/photo-1447752875215-b2761acb3c5d |
| Portrait | Unsplash contributor — natural light portrait, dark background | https://images.unsplash.com/photo-1607746882042-944635dfe10e |
| Architecture | Unsplash contributor — angular museum facade against the sky | https://images.unsplash.com/photo-1449034446853-66c86144b0ad |

## Session 5 — day −2 (composition streak 3 → CLEARS)

| Genre | Attribution | Source |
|---|---|---|
| Landscape | Unsplash contributor — highland valley with road, horizon skyline | https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05 |
| Still life | Unsplash contributor — colourful vegetable bowl on a wood table | https://images.unsplash.com/photo-1512621776951-a57141f2eefd |
| Portrait | Unsplash contributor — candid street-style portrait | https://images.unsplash.com/photo-1517841905240-472988babdf9 |

## Genre totals

Landscape: 6 · Portrait: 4 · Still life: 3 · Architecture: 3 — 16 total.

## Substitutions made while building this manifest

Two candidate photo IDs tried during manifest construction did not make the
final list and were swapped for the ones above:

- `1524634126442-357e0eda3fdb` (intended as a still-life candidate) returned
  HTTP 404 on download — replaced with `1512621776951-a57141f2eefd`.
- `1544117519-31a4b719223d` was initially picked as a portrait candidate by
  its filename-adjacent guess, but on inspection turned out to be a product
  shot of an Apple Watch, not a person — dropped and replaced with
  `1517841905240-472988babdf9` (a genuine candid portrait).

No other manifest photo IDs failed verification.

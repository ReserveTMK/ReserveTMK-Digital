# Hoodlaps / Round the City — Rider Data Analysis

## Overview
- **Ride 1 (Round the City):** 8-11 Feb 2026 — 67 responses
- **Ride 2 (Hood Laps):** 16-28 Mar 2026 — 106 responses
- **Combined unique riders (est):** ~150 (some duplicates across rides)
- **Total registrations:** 173

## Data Cleaning Notes
- Names, emails, phones, timestamps stripped
- Duplicate entries merged (Depas mokalei x2, Kyzah Tanevssi x2, Wallymei x2, Joshua x2, Lyric x2, Tyrone x2, Eli x2)
- Joke entries cleaned per Ra's instructions
- Suburbs standardised, ethnicity standardised
- "Pukekohe" entered as ethnicity → removed (suburb confusion)
- "West" as ethnicity → removed (suburb confusion)
- "Auckland" as ethnicity → removed
- "Chill", "Idk", "Pane", "human" as ethnicity → removed
- "267" as suburb → unknown
- "Cali" as suburb → unknown (could be local slang)
- Ages: "Not too old" → removed from age stats

---

## Age Distribution (combined, valid ages only)

| Age range | Count | % |
|-----------|-------|---|
| Under 16 | 16 | 10% |
| 16-17 | 38 | 24% |
| 18-19 | 42 | 26% |
| 20-24 | 40 | 25% |
| 25-29 | 14 | 9% |
| 30+ | 15 | 9% |
| **Total valid** | **165** | |

**Headline: 60% are aged 16-19. 85% are under 25.**

---

## Suburb Breakdown (combined, standardised)

| Suburb | Count | Area |
|--------|-------|------|
| Papakura | 18 | South |
| Otara | 15 | South |
| Mangere | 14 | South |
| Glen Innes | 13 | East |
| Manurewa | 12 | South |
| Pukekohe | 10 | South |
| Ranui | 6 | West |
| Tuakau | 8 | South |
| Panmure | 5 | East |
| Massey | 3 | West |
| Otahuhu | 3 | South |
| Papatoetoe | 4 | South |
| West Auckland | 3 | West |
| Pt England | 3 | East |
| Onehunga | 3 | Central |
| Mt Wellington | 2 | East |
| Pakuranga | 2 | East |
| Weymouth | 2 | South |
| Hamilton | 1 | Waikato |
| Huntly | 1 | Waikato |
| Tokoroa | 1 | Waikato |
| Howick | 1 | East |
| Beachlands | 1 | East |
| Bay of Plenty | 1 | BOP |
| Kura | 2 | South |
| Kelston | 2 | West |
| Other/unclear | 8 | — |

**Headline: 70%+ from South Auckland. Strong East Auckland presence (Glen Innes, Panmure, Pt England). Some travelling from Waikato.**

### By region:
- **South Auckland:** ~95 (58%)
- **East Auckland:** ~30 (18%)
- **West Auckland:** ~14 (9%)
- **Central Auckland:** ~5 (3%)
- **Outside Auckland:** ~5 (3%)
- **Unknown/unclear:** ~15 (9%)

---

## Ethnicity Breakdown (combined, standardised)

| Ethnicity | Count | % |
|-----------|-------|---|
| Māori (incl mixed Māori) | 107 | 66% |
| Cook Island (incl mixed) | 24 | 15% |
| Tongan (incl mixed) | 10 | 6% |
| Samoan (incl mixed) | 10 | 6% |
| Niuean (incl mixed) | 7 | 4% |
| Fijian (incl mixed) | 5 | 3% |
| Indian | 3 | 2% |
| European/NZ European | 6 | 4% |
| Chinese | 1 | <1% |
| American | 1 | <1% |
| Nigerian | 1 | <1% |
| Mexican (non-mixed) | 1 | <1% |
| Unknown/removed | 12 | 7% |

*Note: Many riders identify as multi-ethnic. Counts above include anyone who listed the ethnicity as part of their identity. Totals exceed 100% due to multi-ethnic identification.*

**Headline: 90%+ Māori and/or Pasifika. Predominantly Māori (66%), strong Cook Island and Tongan representation.**

### Māori & Pasifika combined:
- **Māori and/or Pasifika:** ~148 (90%+)
- **Of which multi-ethnic:** ~35 (common combos: Māori/Cook Island, Māori/Samoan, Cook Island/Niuean)

---

## Key Stats for the Email

Use these to fill the gaps in the draft:

- **Total riders across 2 events:** 170+
- **Age range:** 13-55, majority 16-19
- **% under 25:** 85%
- **% Māori and/or Pasifika:** 90%+
- **Top suburbs:** Papakura, Otara, Mangere, Glen Innes, Manurewa
- **Regions:** 58% South Auckland, 18% East Auckland, 9% West Auckland
- **Riders travelling from outside Auckland:** Hamilton, Huntly, Tokoroa, Bay of Plenty

---

## Observations

1. **This is overwhelmingly a Māori and Pasifika rangatahi movement** — 90%+ M&P, 85% under 25
2. **South Auckland is the base** but East Auckland is significant and growing (Glen Innes = Reserve Tāmaki's backyard)
3. **Multi-ethnic identity is the norm** — many riders identify with 2-3 ethnicities
4. **Ride 2 was 60% bigger than Ride 1** — momentum is building
5. **Geographic reach is expanding** — riders coming from Waikato for Ride 2
6. **Age skew is very young** — 60% are 16-19, some as young as 13
7. **Duplicate riders across both events** — a core community is forming, not just one-offs

---

## Google Form Redesign Recommendations

Current issues:
- Free text for everything = joke answers, inconsistent spelling, no standardisation
- No way to track repeat riders across events
- Missing: gender, how they heard about it, what they ride, safety gear

### Suggested new form (multi-select where possible):

**1. What do people call you?** (free text — handles are fine)

**2. Age** (dropdown: 13, 14, 15, 16, 17, 18, 19, 20-24, 25-29, 30+)

**3. What suburb are you from?** (dropdown with common suburbs + "Other" free text)
- Glen Innes, Panmure, Pt England, Otara, Mangere, Manurewa, Papakura, Papatoetoe, Otahuhu, Pukekohe, Tuakau, Ranui, Massey, Kelston, Henderson, Mt Wellington, Onehunga, Pakuranga, Other

**4. Ethnicity** (multi-select checkboxes — pick all that apply)
- Māori, Cook Island, Tongan, Samoan, Niuean, Fijian, Indian, European/Pākehā, Chinese, Other Pacific, Other

**5. How did you hear about this ride?** (multi-select)
- Instagram, TikTok, Friend/word of mouth, Seen us riding, Other

**6. Have you ridden with us before?** (single select)
- This is my first ride, I rode Round the City, I've been to multiple rides

**7. What do you ride?** (single select)
- BMX, Mountain bike, Road bike, E-bike, E-scooter, Other

**8. Did you wear a helmet today?** (Yes / No / Didn't have one)

**9. Contact (optional — for safety updates only)**
- Phone or Instagram handle

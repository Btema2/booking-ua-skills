# Design notes — measured from the handoff prototype

Extracted once, in Phase 2, from `reference/design-handoff/Room Booking.dc.html`
(its Redlines · 03, Responsive · 01, States · 02 and Tokens · 04 sections).
**Build from this file and `apps/web/src/styles/tokens.css`.** Reopen the
handoff only if something is genuinely missing from both.

Token names below are the ones declared in `tokens.css`. Raw values are
repeated only where no token exists.

---

## 1 · Week grid geometry

One CSS Grid per day column: `grid-template-rows: repeat(20, var(--slot-h))`.
Bookings are ordinary grid items with `grid-row: span n`. No absolute
positioning, no overlap resolution, no library.

| Thing | Desktop | Mobile (candidate A) | Token |
|---|---|---|---|
| Row height (= 30 min) | `44px` | `56px` | `--slot-h` / `--slot-h-mobile` |
| Row height range (prototype prop) | `34px`–`64px`, step 2 | — | `--slot-h-min` / `--slot-h-max` |
| Rows | 20 (09:00–19:00, 30-min steps) | 20 | `--grid-rows` |
| Day range in minutes | 540 → 1140, step 30 | same | `--grid-day-start` / `--grid-day-end` / `--grid-step` |
| Time-gutter width | `76px` | `52px` | `--time-gutter-w` / `--time-gutter-w-mobile` |
| Track template | `76px repeat(7,minmax(0,1fr))` | `52px minmax(0,1fr)` | `--grid-columns` / `--grid-columns-mobile` |
| Day-column width | fluid `minmax(0,1fr)` — never fixed | full remaining width | — |
| Sticky header height | `66px` | — (pager chrome instead) | `--grid-head-h` |
| Header sticky offset | `top: 65px` (under the app bar) | — | `--grid-head-sticky-top` |
| Grid frame | `1px` outline-variant, radius `--radius-lg` (28px), `overflow: clip` | same, plus `max-height: min(68vh,640px)` | `--grid-max-h-mobile` |
| Scroll container max height | page-level | `min(68vh,640px)` | `--grid-max-h-mobile` |

The redline drawing itself renders two 190px columns; that is the width of the
illustration, **not** a column spec. Real columns are `1fr`.

### Grid borders and rules

| Rule | Value | Token |
|---|---|---|
| Hour line | `1px solid` `--color-outline-variant` | `--border-hairline` |
| Half-hour line | `1px solid rgba(207,195,173,.45)` (same colour at 45% alpha) | `--color-rule-half-hour` |
| Column separator | `1px solid` `--color-outline-variant`, `border-right` per column | `--border-hairline` |
| Header bottom | `1px solid` `--color-outline-variant` | `--border-hairline` |
| Now indicator | `2px` line + `10px` dot, `--color-error`, red over **today only** | `--now-line-h` / `--now-dot` |
| Gutter label | `11.5px`/700, tabular-nums, padding `2px 10px 0 0`, hung at the top of its hour | `--gutter-label-pad` |

Column backgrounds: today `--color-today-column` (`rgba(255,225,208,.34)`),
past day `--color-past-day` (`rgba(226,210,181,.30)`), non-working day
`--color-surface-container`, otherwise `--color-surface-container-lowest`.
Today's **header** cell is tinted `--glass-today-head`
(`color-mix(in srgb,#ffd0b4 78%,transparent)`); past days and weekends drop the
whole header cell to `opacity:.6`.

---

## 2 · Booking block

| Property | Desktop | Mobile | Token |
|---|---|---|---|
| Cell gutter (padding on the grid item) | `1.5px 3px` | `3px 8px` | `--cell-pad` / `--cell-pad-mobile` |
| Block radius | `9px` | `10px` | `--block-radius` / `--block-radius-mobile` |
| Block padding, span ≥ 2 | `7px 9px` | `9px 12px` | `--block-pad-tall` / `--block-pad-tall-mobile` |
| Block padding, span 1 | `4px 8px` | `7px 11px` | `--block-pad-short` / `--block-pad-short-mobile` |
| Meta-to-title gap | `2px` | `2px` | `--block-gap` |
| Min height | none declared — the floor is one row minus the cell gutter: **41px** desktop, **50px** mobile | | |
| Title size | `13px` (≥2 rows) / `12px` (1 row), 600, line-height `1.25` | `14px` / `13px` | `--text-slot-title`, `--text-slot-title-compact`, `--text-slot-title-mobile*` |
| Title line-clamp | **1** line for a 1-row block, **2** for 2–3 rows, **4** for 4+ rows, plus `overflow-wrap:break-word` | same | `--block-clamp-1row` / `-2row` / `-4row` |
| Owner / time line | always **one** line, `white-space:nowrap` + `text-overflow:ellipsis`, so the name can never push the title out | same | `--text-slot-meta` (11px/700/0.04em) |
| Hover | `box-shadow: var(--shadow-el-2)`, `transition .16s` | — | `--dur-block` |

Back-to-back bookings stay two separate blocks: each cell keeps its
`1.5px 3px` padding, so touching blocks show a 3px channel plus two borders.

---

## 3 · Own vs other booking — the non-colour signals

Colour is the **fourth** signal, never the only one.

| | My booking | Someone else's |
|---|---|---|
| Border | **`2px solid`** `--color-primary`, all four sides | `1px solid` `--color-outline-variant` + **`4px` left bar** `--color-secondary` |
| Glyph | **filled dot**, `7px` desktop / `8px` mobile, `--color-primary` | **outline person glyph** (Lucide, stroke-width 3), `10px` desktop / `11px` mobile, `--color-secondary` |
| Label | literal word **`Ви`**, then ` · ` and the range — `Ви · 10:00–11:00` | owner's **first name**, then ` · ` and the range — `Тарас · 11:00–12:00` |
| Meta case | uppercase, letter-spacing `.04em` (desktop) / `.03em` (mobile) | sentence case, letter-spacing `.02em` (desktop) |
| Fill / ink | `--color-primary-container` / `--color-on-primary-container` | `--color-secondary-container` / `--color-on-secondary-container` |
| Element | `<button>` — clicking opens the cancel dialog | non-interactive `<div>` — others' bookings cannot be cancelled |
| Token | `--border-own`, `--block-dot` | `--border-owner-bar`, `--block-glyph` |

Other slot states:

| State | Fill | Edge | Signal |
|---|---|---|---|
| Free (desktop) | transparent, radius `7px` | none | hover reveals a `+` and a `--color-primary-container` fill (`--dur-fast`) |
| Free (mobile) | transparent, pill `999px` | `1.5px dashed` outline-variant | always-visible `+`, one tappable block per free row |
| Selected | `--glass-selected-slot` (`#ffe1d0` @ 55%) | `2px dashed` `--color-primary` | dashed edge + the label «Обраний слот» |
| Past / disabled | `--color-past-day` + 135° hatch `--pattern-past` | none | texture, not a colour change; not focusable, no pointer |
| Non-working day | `--color-surface-container` | none | header at 60% opacity, no hover affordance |

A contiguous run of dead rows is merged into **one** cell so the hatch reads as
a single striped block, not 20 tiles.

---

## 4 · App bar, nav, page frame

| Thing | Value | Token |
|---|---|---|
| App bar height | `65px` (measured — the grid header pins at `top:65px`) | `--appbar-h` |
| App bar surface | `--glass-appbar` over solid fallback `#f9f1e2`, `blur(14px) saturate(1.25)`, bottom `1px` outline-variant | `--blur-appbar` |
| App bar padding | `12px 32px`; `10px 14px` ≤760px | `--appbar-pad` / `--appbar-pad-mobile` |
| App bar gap | `28px`; `12px` ≤760px; `8px` ≤420px | `--appbar-gap*` |
| Nav tab | pill, padding `8px 16px`, `14px`/600; active fill `--color-surface-container-highest` | `--nav-tab-pad` |
| Nav tab ≤760px | padding `8px 10px`, `13px` | `--nav-tab-pad-mobile` |
| Icon button (bell, week arrows) | `40px` / `42px` circles, `1px` outline-variant, `--color-surface-container-lowest` | `--nav-icon-btn` |
| Avatar / logout pill | `30px` avatar, pill padding `5px 14px 5px 5px` | `--nav-avatar` |
| Timezone chip | pill `6px 12px`, `12px`/600; hidden ≤760px | — |
| Brand text | hidden ≤420px | — |
| Page max width | `1440px`; **`1000px`** on My bookings | `--page-max` / `--page-max-narrow` |
| Page padding | `clamp(24px,6vw,44px) clamp(16px,5vw,32px) 56px`; schedule top `clamp(18px,5vw,28px)` | `--page-pad-*` |

Breakpoints: the handoff uses `max-width:760px` and `max-width:420px` in CSS,
and switches the grid to the pager in JS at **`vw < 761`**. `--breakpoint-desktop`
is `760px` (the only literal in the handoff) — for the grid swap use the JS
boundary, i.e. desktop at ≥761px.

---

## 5 · Room list and room card

Grid: `repeat(auto-fill,minmax(min(300px,100%),1fr))`, gap `16px`
(`--room-grid-columns`, `--room-grid-gap`). There is **no breakpoint-keyed
column count** — the count falls out of the 300px minimum, so it is 4 columns
at 1440px, 3 at ~1100px, 2 at ~760px, 1 below ~620px.

| Part | Value | Token |
|---|---|---|
| Card | `<button>`, `1px` outline-variant, `--color-surface-container-low`, radius `--radius-lg` (28px) | |
| Card padding / inner gap | `22px 24px` / `14px` | `--room-card-pad` / `--room-card-gap` |
| Card hover | `--color-surface-container`, `translateY(-2px)`, `--shadow-el-2`, `.18s var(--ease-spring)` | `--dur-lift` |
| Room name | Rubik `28px`, line-height `1.1` | |
| **Amenities line** | **yes** — `r.note`, `13px` `--color-on-surface-variant`, directly under the name (e.g. «Проєктор, маркерна дошка») | `--text-body-small` |
| Capacity badge | `44px` circle, primary-container / on-primary-container, `15px`/700, **number only** | `--room-cap-badge` |
| Floor tag | `«2 поверх»`, tertiary-container / on-tertiary-container, `12px`, padding `4px 11px` | `--room-tag-pad` |
| Availability tag | `«Вільно сьогодні: N год»` or `«Сьогодні зайнято»`; ≤6 free half-hours flips it to primary-container, otherwise secondary-container | |
| Capacity filter | **pill chips**, options `Будь-яка / від 4 / від 6 / від 8 / від 12 / від 20`, padding `8px 15px`, `13.5px`/600, gap `6px`; selected = `--color-primary` fill + on-primary ink; unselected = surface-container-lowest + `1px` outline-variant | `--cap-chip-pad` / `--cap-chip-gap` |

---

## 6 · Mobile — candidate A (single-day pager). Build this one.

Candidate B (horizontally scrolling week) is documented in the handoff but
explicitly **not** to be built.

| Thing | Value | Token |
|---|---|---|
| Reference frame | `390px × 760px` | `--phone-frame-w` / `--phone-frame-h` |
| Day pager | `repeat(7,1fr)`, gap `5px` | `--pager-gap` |
| Day chip | radius `14px`, padding `8px 2px 7px`, min-height `48px`, `.14s` transition | `--pager-chip-*` |
| Day chip type | DOW `10px`/700/`.05em` uppercase; number Rubik `17px`/1.1 | |
| Day chip states | active `--color-primary` + on-primary ink; today `color-mix(#ffd0b4 65%)`; weekend `--color-surface-container` @ `.75` | `--glass-today-head-pager` |
| Slot height | `56px` (redline prose annotates candidate A at `52px` — the implemented pager uses 56) | `--slot-h-mobile` |
| Time gutter | `52px`, label `11px`/700, padding `3px 8px 0 0` | `--time-gutter-w-mobile` |
| Now line | `left:52px; right:0`, `2px` `--color-error`, `10px` dot at `left:-5px` | |
| Bottom bar | padding `12px 16px 16px`, top `1px` outline-variant, glass `#e2d2b5` @88% + `blur(14px) saturate(1.2)` → **~76px tall** (12 + 48 + 16) | `--bottom-bar-pad` |
| Bottom-bar nav item | `60px` wide, `19px` icon, `10px`/700 label | `--bottom-bar-item-w` |
| Bottom-bar CTA | pill, min-height `48px`, padding `0 22px`, Rubik `15px`, primary fill | `--bottom-bar-cta-h` |
| My-bookings row ≤760px | stacks to a column, padding `14px 16px`, cancel button goes full width | |

---

## 7 · Contrast floor — 7:1 inside the grid

Every text colour inside the grid clears **7:1 on its own fill**, and nothing
decorative sits between text and background.

| Ink | On fill | Ratio | OK for grid |
|---|---|---|---|
| `--color-on-primary-container` `#643312` | `--color-primary-container` `#ffe1d0` | **8.4:1** | yes — my booking |
| `--color-on-secondary-container` `#3d472b` | `--color-secondary-container` `#e1eecc` | **8.9:1** | yes — other's booking |
| `--color-on-surface-variant` `#5a5147` | `--color-surface-container-lowest` `#fffcf6` | **7.4:1** | yes — gutter labels, free-slot text |
| `--color-on-surface` `#201e1d` | surface | **15.2:1** | yes — body ink |
| `--color-on-tertiary-container` `#2e2b25` | `--color-tertiary-container` `#eee7db` | **12.6:1** | yes — chips |
| `--color-on-error-container` `#5c1a12` | `--color-error-container` `#fadfd8` | **10.1:1** | yes — error banners |
| `--color-on-primary` `#fffcf6` | `--color-primary` `#b2622d` | 4.5:1 | **no** — buttons/chrome only, never grid text |
| `--color-on-secondary` `#fffcf6` | `--color-secondary` `#56633f` | 6.6:1 | **no** — chrome only |
| `--color-on-tertiary` `#fffcf6` | `--color-tertiary` `#645c50` | 6.7:1 | **no** — chrome only |

The past-slot treatment is a **hatch texture over a dim**, deliberately not a
colour change, so the contrast of anything drawn on top is untouched.

On the auth tile the standard roles measure differently against the ceramic
gradient: `--color-on-surface` 14.6:1, `--color-on-surface-variant` 7.1:1,
mode-switch link `--color-on-primary-container` 8.0:1 — **never**
`--color-primary`, which drops to 3.6:1 on the tile's lower stop.

---

## 8 · States — the three rules

Loading keeps the layout (**skeletons on surface-container, never a centred
spinner**), empty always names the next action, error never discards typed
input.

| Screen | Empty | Loading | Error (server unreachable) |
|---|---|---|---|
| Room list | icon circle `48px` on surface-container-high, Rubik `19px` title «Таких кімнат немає», `13px` body naming the largest room, ghost pill «Показати всі» | two shimmer cards, `--pattern-skeleton` + `--dur-shimmer` linear infinite, staggered `.15s`, bar placeholders on `--color-surface-container-highest` | frame border switches to `--color-error-container`; error-container icon circle; «Сервер не відповідає»; two actions — «Повторити» (primary pill) + «Показати збережену копію» (ghost pill) |
| Week schedule | flat 5-column tint block + «Цього тижня все вільно» / «Жодного бронювання — оберіть будь-який слот» | caption «Завантажуємо розклад…» over a shimmering block skeleton that keeps the grid shape | error-container banner «Розклад може бути застарілим» + last-update time; grid drops to `opacity:.45; filter:grayscale(.35)`; booking disabled; «Оновити зараз» |
| Create booking | dashed-outline empty fields (`1px dashed` outline-variant, `--color-outline` placeholder ink) | fields locked at `opacity:.55` on surface-container-high, submit disabled at `.72` with a `15px` spinner (`--dur-spin`) and «Бронюємо…» | banner «Бронювання не збережено» — **typed values are still in the fields**; «Повторити» + «Закрити» |
| My bookings | secondary-container calendar circle, «Майбутніх бронювань немає», primary pill «Обрати кімнату» | two shimmering row skeletons, `40px` leading square + two bars | «Не вдалося оновити список», shows the cached copy, cancel disabled offline |
| Auth / notifications | bell circle + «Сповіщень немає» + the reminder-lead-time sentence | two `44px` pill skeletons + disabled «Входимо…» button | banner «Сервер недоступний»; email kept, password field re-outlined `2px` `--color-error` |

Skeleton shimmer: `--pattern-skeleton`, `background-size: 320px 100%`,
`1.35s linear infinite`, sweeping `-320px → 320px`. Everything collapses to
`--dur-reduced` (`.001ms`) under `prefers-reduced-motion: reduce`.

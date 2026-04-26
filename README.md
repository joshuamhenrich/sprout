# Sprout

A kid-first budgeting app for ages 9–13.

Built around three ideas:

- **Jars** — every dollar lives in Save, Spend, or Give. Income auto-splits.
- **Goals** — long-term saving targets that live inside a jar.
- **Schedule** — a time-based view of upcoming income (allowance, gigs) and outgoing money (subscriptions). Confirmed events look solid; "maybe" gigs look faded so the forecast doesn't lie.

## Status

Working prototype. State persists in `localStorage` so refreshing keeps your data. No backend yet.

You can:

- Log money in (with auto-split or pick a jar) and money out
- Create new goals with a custom name, target, and emoji
- Add to an existing goal from your Save jar
- Add new schedule items: weekly/monthly/one-time income, subscriptions, or "maybe" gigs

## Run it

Open `index.html` in any modern browser. That's it. No build step.

## Vision

The app grows up with the kid:

- **Little kid mode (5–8)** — one big goal jar with a progress ring. Future.
- **Tween mode (9–13)** — current scope. Jars, goals, schedule.
- **Teen mode (14–17)** — adds full categories, timesheets with hourly rates, recurring expenses. Future.

Parental setup flow is also future scope.

## Roadmap

- [ ] Edit and delete existing goals, transactions, schedule items
- [ ] Cash-flow forecast chart over the next 30 days
- [ ] Timesheet flow with hourly rate logging (teen mode preview)
- [ ] Onboarding: kid name, avatar, jar split percentages, parent setup
- [ ] Charity picker for the Give jar
- [ ] Real backend (replace `localStorage`)
- [ ] Little-kid mode and teen mode
- [ ] Native mobile app (React Native)

## Project layout

- `index.html` — page shell and phone frame
- `styles.css` — all styling
- `app.js` — state, persistence, rendering, forms
- `README.md` — this file

## Tech notes

Vanilla HTML/CSS/JS on purpose. The shape of the data and the UX flows matter more than the framework right now. Migrating to React Native happens after the design has been tested with real kids.

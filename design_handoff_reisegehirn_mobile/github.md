repo: andthechamp/reisegehirn-app
branch: main
path: src

## Last sync
date: 2026-08-20T09:47:00Z

### Updated in this project
- iOS mobile app design (7 screens) built on the web app's data model and copy
- New visual direction: warm analog logbook (paper tones, serif + typewriter type)
- Bottom tab bar (Reise · Tage · Ausflüge · Chat) and direct camera capture added
- Icons and German labels lifted from the repo's own icon set and components

## Screen map
| Screen (Reisegehirn Mobile.dc.html) | Repo files |
| --- | --- |
| 1a Anmelden | src/components/AuthForm.tsx, src/app/login/page.tsx |
| 1b Reiseseite | src/app/trips/[id]/page.tsx, src/components/TripHero.tsx, CabinCard.tsx, MemoryItem.tsx |
| 1c Tages-Navigation | src/components/PortDaySwiper.tsx, ExcursionCard.tsx, src/lib/format-time.ts |
| 1d Hafenrecherche | src/components/PortResearch.tsx, ResearchCard.tsx, icons.tsx |
| 1e Schiff & Kabine | src/components/ShipResearch.tsx, CabinResearch.tsx, src/lib/cabin.ts |
| 1f Ausflüge | src/components/ExcursionForm.tsx, ExcursionCard.tsx, src/lib/document-upload.ts |
| 1g Chat | src/components/ChatPanel.tsx, ChatWidget.tsx |
| Shell / palette / type | src/app/layout.tsx, tailwind.config.ts, src/components/SiteHeader.tsx |

# Build log: Pocketleaf

One line per screen: ID, date, status, what is missing, what was harder than
expected. Checked in the web build: an Expo web export running on real SQLite
(WebAssembly), driven by a headless browser at 390×844 and 1440×900.
Screenshots are in `replica/clone-screens/`.

| ID | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-10-18 | done | — | expo-sqlite on web needs WebAssembly plus cross-origin isolation headers (`metro.config.js`), and has no FTS5, so search falls back to LIKE there |
| data | 2026-10-18 | done | — | 34 tests on real SQLite (node:sqlite). They caught a DST-gap bug (02:30 on the spring-forward night moved back an hour) and a repeating reminder that kept its old OS entry |
| S01 Home | 2026-10-18 | done | — | the chip row was offset at desktop width; the folder filter falls back to All if that folder is deleted elsewhere |
| S02 New (FAB) | 2026-10-18 | done | — | — |
| S03 Note editor | 2026-10-18 | done | formatting toolbar sits in the top bar, not above the keyboard | autosave has to flush on blur, background, back and close; only a *brand-new* note left empty is discarded |
| S04 Checklist editor | 2026-10-18 | done | — | drag to reorder written with PanResponder (no extra native library). The React Compiler lint rules forced the gesture into a small class. It works with touch and with a mouse |
| S05 Colour | 2026-10-18 | done | — | — |
| S06 Font and size | 2026-10-18 | done | — | — |
| S07 Reminder | 2026-10-18 | partial | **not verified on a phone**: notification delivery, the permission prompts, the exact-alarm setting | the web preview gets date/time steppers, phones get the native pickers; quick picks are relative to now |
| S08 Folders | 2026-10-18 | done | reordering folders | wa-sqlite reports a UNIQUE violation as "Error finalizing statement", so duplicate names are now checked before writing, on every platform |
| S09 Search | 2026-10-18 | done | highlighting the match (could) | the screens underneath stay in the DOM on web, so tests have to target visible elements |
| S10 Note actions | 2026-10-18 | done | — | — |
| S11 Trash | 2026-10-18 | done | — | — |
| S12 Settings | 2026-10-18 | done | — | — |
| S13 Backup | 2026-10-18 | done on web, partial on phones | the share sheet and the daily snapshots are not verified on a phone | restore merges by id (newer wins, nothing deleted); restoring the same backup twice changes nothing (checked) |
| S14 Notification | 2026-10-18 | partial | **needs a phone** | tap → `/note/[id]`, including the tap that launches the app (`getLastNotificationResponse`) |

## Flows checked in the web build (all pass, three runs in a row, no console errors)

- **F01:** write a note; it survives a reload; an empty new note is discarded.
- **F02:** make a list; Enter adds an item; tick moves it to Done; the card
  shows "1 of 2 done".
- **F03:** colour and font change.
- **F04:** create a folder; a duplicate name (any case) is blocked; move a
  note into it; filter by it.
- **F05:** search ignores accents ("cafe" finds "café"), finds list items, and
  shows a "nothing found" state.
- **F06:** set a reminder from a quick pick; the chip shows on the card.
- **F07:** share is offered.
- **F08:** trash, undo, trash again, restore from the trash screen.
- **F09:** back up (download) and restore the same file ("Already up to
  date").
- **Drag:** drag "Oat milk" down two places; the order persists.
- **Keyboard:** Tab reaches the New button and Enter opens it; Escape closes
  sheets.

## Deviations from the plan

- **Exact alarms.** `delivery: 'alarmClock'` is used, so reminders are exact
  when Android allows it. Android 14+ asks you to allow exact alarms, and S07
  shows a banner with the setting.
- **The design route** `/design` is still in the app, as a development page.
  Hide it before giving the app to anyone else.
- **Checklist drag** uses PanResponder instead of the
  `react-native-draggable-flatlist` the architecture planned. That means no
  extra native dependency.

## Before calling it done on your phone

1. Build a development APK (`eas build --profile development`, or
   `npx expo run:android`) and install it.
2. Set a reminder 2 minutes out. Let it fire with the app open, then closed,
   then after a reboot. Tap it, and check the note opens.
3. Back up, uninstall, reinstall, restore.

`/replica-test` will turn these into a checklist with results.

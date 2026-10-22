# DOSchedule

**DOSchedule** is DOS/ASCII-themed planner for your terminal. Tasks, events and notes go into one simple list, with a month calendar and a week calendar behind it. Your notes are saved as plain text files (Markdown) on your own computer. I designed **DOSchedule** to help me solve one problem - continuous switching between different apps, calendars, notes, etc.

```
╔═ DOSchedule ══════════════════════════════════════════ Wed 14 Oct 2026  09:00 ═╗
║ ── TASKS (2) ───────────────────────────────────────────────────────────────── ║
║ > [ ] !!! Write quarterly report                                due Fri 16 Oct ║
║   [ ] !   Call the bank                                                        ║
║                                                                                ║
║ ── EVENTS (1) ──────────────────────────────────────────────────────────────── ║
║    o      14:30-15:30 Dentist                                                  ║
║                                                                                ║
║ ── NOTES (1) ───────────────────────────────────────────────────────────────── ║
║    -      Ask Sam about the trip                                               ║
║                                                                                ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║ x task   o event   - note   ! priority   date at the end, e.g.  o Dentist 14.» ║
║ >                                                                              ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

## Features

* **Everything on one screen.** Tasks, events, and notes sit together in one tidy list.
* **Keyboard only.** Because it's all about an easy-to-understand workflow.
* **Dates, in all the ways.** Tomorrow, Fri, 14.3.2026, 3/14/26, March 14, in 2 weeks, with live preview showing how your entry will be read.
* **Priorities and times.** With color tags and 12/24hr formats.
* **Deadline tasks with sessions.** Because the deadline day isn't the work day.
* **Month and week calendars.** Plan your week and month. Move stuff freely.
* **Instantly find anything.** Results appear as you type. Capitals and accents don't matter.
* **Retro look.** Five color schemes paying homage to the classics. Also, a Plain ASCII mode for terminals that can't draw the box characters.
* **Your notes stay yours.** DOSchedule generates Markdown text files. No account, no cloud, no tracking.
* **Free, and yours to edit.** Made for Windows; free and open source (MIT).

## Who is it for?

DOSchedule is for you if you…

* …**hate switching.** Your plan is a keystroke away, with no browser tab, no app window and no phone.
* …**love retro design.** You miss DOS, Norton Commander, Turbo Pascal and amber screens, and you'd like a planner that looks like them and works.
* …**like bullet journals** but want something faster than pen and paper, without the fiddly parts of a modern to-do app.
* …**care about your data.** Everything is plain text in a folder you control. There's no sign-up, and nothing is sent anywhere.

It's probably not for you if you want a phone app, reminders or alarms, or sharing and team features. DOSchedule is a personal planner that runs on one computer (plus any folder you sync yourself). This means you're solely responsible for your data. Make backups. It's a healthy habit.

## Get started

You need [Node.js](https://nodejs.org) 18 or newer (free). Check with `node --version`.

1. Download this project (green **Code** button, then **Download ZIP**) and unzip it anywhere.
2. Open a terminal in that folder and type `node doschedule.js`. On Windows you can also double-click `doschedule.cmd`.

To leave, press **Ctrl+Q**.

* **First start:** a welcome window says where your notes will be saved and lets you use that folder or choose another one. It asks only once.
* **Where are my notes?** In `C:\Users\<your name>\AppData\Roaming\DOSchedule` unless you chose another folder (type `%APPDATA%` in the Explorer address bar to find `Roaming`). To back up, copy that folder.
* **Updating:** download the new version and unzip it anywhere. Your notes and your choice of folder stay, because they belong to your Windows account, not to the program folder. (If you keep a folder named `data` next to the program, copy it into the new one.)

<details>
<summary><b>Windows says "Unknown publisher"?</b></summary>

When you double-click `doschedule.cmd` from a downloaded ZIP, Windows may say "Windows protected your PC". It does that for any file from the internet that isn't digitally signed; nothing is wrong with the file, and you can read every line of it. Either click **More info**, then **Run anyway**, or start it from a terminal with `node doschedule.js`, which doesn't ask. You can also right-click the ZIP before unzipping, choose **Properties**, tick **Unblock** and click OK.
</details>

## Your first minute

Type at the bottom and press **Enter**:

| You type                    | You get                          |
|-----------------------------|----------------------------------|
| `x Buy ice cream`           | a task                           |
| `o Dentist tomorrow 14:30`  | an event, tomorrow at 14:30      |
| `- Ask Sam about the trip`  | a note                           |

Then: **Up / Down** select an entry and **Enter** on an empty line ticks it off. **Tab** switches between the main list, month calendar and week calendar. **/** searches everything. **?** shows help. **F10** opens the options. **Ctrl+Q** quits.

## Writing entries

| You type                      | Result                                                   |
|-------------------------------|----------------------------------------------------------|
| `x Buy ice cream`             | task                                                     |
| `o See the dentist 14.3.2026` | event on 14 March 2026                                   |
| `- check that website`        | note                                                     |
| `x!!! text`  `x!! text`  `x! text` | high / medium / low priority (red, yellow, green) |

A line above the command line shows **exactly how your entry will be read** before you press Enter. Ticked entries sink to the bottom, greyed out; the cursor stays on its row, so you can tick a run with Enter. Press Enter on a ticked entry to un-tick it.

**Dates** go anywhere in the text. No date means today (or the highlighted day on a calendar):

```
tomorrow    fri    in 3 days    in 2 weeks
14.3.2026   14.3.26   3/14/26   2026-03-14
march 14    mar 14th   14 march
```

**Event times** work on events only: `o Dentist 14:30`, `o Dentist 14:30-15:30`, `o Call 2pm`, `o Lunch at 12:30`. Events are sorted by time, and events without a time come first.

**Deadline tasks:** `>` is the deadline, `@` are the work days. Each work day is a separate session that you tick off by itself.

```
x!!! Write report >fri @wed @thu       deadline Friday, work Wednesday and Thursday
x!!! Write report >fri @2d             the 2 working days before the deadline
x Gym @mon,wed,fri                     no ">": the deadline is the last work day
```

It shows on the main list on each work day (`due Fri 16 Oct`) and from the deadline on (red when overdue). Ticking on a work day ticks that session; ticking the last session, or ticking on the deadline day, finishes the whole task. Deleting on a work day deletes that session; on the deadline day it deletes the whole task. To move a session, look at that day, press **F2**, press **Ctrl+W** to remove the day, type the new one (`@thu`) and press Enter.

## The screens

**Tab** goes main list, month, week (**Shift+Tab** goes back). Typing at the bottom adds an entry on all three.

* **Main list (today):** today's tasks, **overdue** tasks (date in red), deadline tasks on their work days, today's events, and notes from today and the last 7 days (you can change this in the options). Long entries wrap, nothing is cut off. Entries for other days are saved and shown on the calendars.
* **Month calendar:** weeks start on Monday. Arrows move the highlighted day, **PgUp / PgDn** change month, **Ctrl+T** jumps to today, **Enter** opens the day's list. Typing adds to the highlighted day. Needs a terminal of at least 70 x 16.
* **Week calendar:** the highlighted day is a wide column with everything in full. Left / Right change day, Up / Down select an entry, **PgUp / PgDn** change week. Needs at least 76 x 16.

## Find

Press **/** (or **Ctrl+F**) and type. All words must match, in any order, and capitals and accents don't matter (`cuprija` finds "ćuprija"). Up / Down choose, **Enter** goes there, **Esc** closes. Find never changes anything.

## Keys

| Key                        | Action                                              |
|----------------------------|-----------------------------------------------------|
| Tab / Shift+Tab            | next / previous screen                              |
| Up / Down, PgUp / PgDn     | select an entry                                     |
| Enter (empty line)         | tick a task / mark an event as passed               |
| Enter (with text)          | add the entry (or save it while editing)            |
| F2 or Ctrl+E               | edit the selected entry                             |
| Del or Ctrl+D              | delete the selected entry (asks first)              |
| Esc                        | clear the command line / cancel an edit             |
| `/` or Ctrl+F              | find                                                |
| `?` or F1                  | help                                                |
| F10 or Ctrl+O              | options                                             |
| Ctrl+Q                     | quit                                                |

In the VS Code terminal Ctrl+F belongs to VS Code, so use `/`.

## Options (F10)

Up / Down pick a row, Left / Right change it, Esc closes. Changes are saved at once.

* **Color scheme:** Classic, Blue, Amber, Green or Light.
* **Frame style:** *DOS lines*, or *Plain ASCII* if your terminal shows `?` or boxes instead.
* **Notes on the main list:** today only, or the last 1, 3, 7 (default), 14, 30 days, or all.
* **Start with:** the main list, the month calendar or the week calendar.
* **Choose notes folder...:** opens a folder browser. **Enter** opens a folder, **Backspace** goes up, **N** makes a new folder, **T** lets you type a path, and **Space** uses the folder shown at the top. You can copy your notes along. Nothing is ever moved or deleted.
* **Use the automatic notes folder:** goes back to the default folder.
* **Delete all data...:** deletes every entry, after two confirmations. **[ No ]** is selected by default.

## Command line

```
node doschedule.js                   start the planner
node doschedule.js --where           show which folder holds your notes
node doschedule.js --reset-folder    forget the folder chosen in the options
node doschedule.js --data <folder>   use another notes folder for this run
node doschedule.js --help            list these
```

## Your notes are plain files

One Markdown file per month, with one section per day. You can read them in any text editor:

```markdown
# 2026-03

## 2026-03-14 Saturday
- [ ] !!! Buy ice cream
- [x] Pay rent
- [o] 14:30-15:30 Dentist
- [-] Check that website
```

`[ ]` open task, `[x]` done, `[o]` event, `[ø]` event that has passed, `[-]` note. Everything is saved after every change.

## License and author

DOSchedule is free software under the [MIT License](LICENSE): you may use, copy, change and share it.
Copyright (c) 2026 Arnel Šarić Sharan (dukkhat).

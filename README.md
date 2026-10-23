# DOSchedule

**DOSchedule** is DOS/ASCII-themed planner for your terminal. I designed **DOSchedule** to solve the problem of continuous switching between different apps, calendars, notes, etc.

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
* **Dates, in all the ways.** Tomorrow, >fri, 14.3.2026, 3/14/26, March 14, in 2 weeks, with live preview showing how your entry will be read.
* **Priorities and times.** With color tags, and times typed as 14:30 or 2pm.
* **Deadline tasks with sessions.** Because the deadline day isn't the work day.
* **Month and week calendars.** Plan your week and month. Move stuff freely.
* **Instantly find anything.** Results appear as you type. Capitals and accents don't matter.
* **Retro look.** Five color schemes paying homage to the classics, plus a Plain ASCII mode for terminals that can't draw the box characters.
* **Your notes stay yours.** DOSchedule generates Markdown text files. No account, no cloud, no tracking.
* **Free, and yours to edit.** Made for Windows; free and open source (MIT).

## Who is it for?

DOSchedule is for you if you…

* …**hate switching.** No browser tabs, no app windows and no phone.
* …**love retro design.** You remember (and miss!) DOS, Norton Commander, and Turbo Pascal.
* …**like bullet journaling** but want something faster than pen and paper, without the fiddly parts of a modern to-do app.
* …**care about your data.** Everything is plain text in a folder you control. There's no sign-up, and nothing is sent anywhere.

It's not for you if you want a phone app, reminders or alarms, or team features. DOSchedule runs on one computer (plus any folder you sync yourself). This means you're solely responsible for your data. Make backups. It's a healthy habit.

## Get started

You need [Node.js](https://nodejs.org) 18 or newer (free). If Node.js is missing, `doschedule.cmd` says so and shows where to get it.

1. Download this project: green **Code** button on GitHub, then **Download ZIP**. Unzip it anywhere.
2. Double-click `doschedule.cmd` on Windows or open a terminal in that folder and type `node doschedule.js`. 

<details>
<summary><b>Windows says "Unknown publisher"?</b></summary>

When you double-click `doschedule.cmd`, Windows may say "Windows protected your PC" or display scary-looking security warning asking you if you want to run the software. It does that for any file from the internet that isn't digitally signed. Nothing is wrong with the file, you can read every line of it, and feel free to scan it with your antivirus, too! Either click **More info**, then **Run anyway**, or click **Run**, or start it from a terminal with `node doschedule.js`, which doesn't ask.
</details>

* **First start:** a welcome window says where your notes will be saved and lets you use that folder or choose another one. It asks only once.
* **Where are my notes?** In `C:\Users\<your name>\AppData\Roaming\DOSchedule` unless you chose another folder (type `%APPDATA%` in the Explorer address bar to find `Roaming`). To back up, copy that folder.
* **Updating:** download the new version and unzip it anywhere. You don't need to overwrite the previous files. Choice of notes folder is remembered. If you keep a notes folder next to the program, copy it into the new one.


## Your first minute

Type at the bottom and press **Enter**:

| You type                    | You get                          |
|-----------------------------|----------------------------------|
| `x Buy ice cream`           | a task                           |
| `o Dentist tomorrow 14:30`  | an event, tomorrow at 14:30      |
| `- Ask Sam about the trip`  | a note                           |

Then: **Up / Down** select an entry and **Enter** on an empty line ticks it off. **Tab** switches between the main list, month calendar and week calendar. **/** searches everything. **?** shows help. **F10** opens the options. **Ctrl+Q** quits.

## Top 10 tips

1. **Start with a symbol.** `x` for a task, `o` for an event, and `-` for a note. 
2. **Write the date.** There are many ways to do it, anywhere in the sentence, after the starting symbol. Without a date, the entry defaults to today.
3. **Use `!`, `!!` and `!!!` for what matters.** Some themes also do color coding for priority tasks.
4. **Tick with Enter.** Done items sink to the bottom. Made a mistake? Press Enter again to un-tick it, **F2** to edit, **Del** to delete (it asks first).
5. **For deadlines, say when you'll work on it.** `x Write review >fri @wed @thu` puts the work on Wednesday and Thursday with the Friday deadline, and you tick each session separately.
6. **Tab moves you around.** Press Tab to see the month and week views. If a message says "(not on today's list)", the entry was saved for another day.
7. **Can't find something? Press `/`.** Results appear as you type. Old and finished entries are included.
8. **Make it comfortable (F10).** Pick a color scheme, choose how many days of notes the main list shows, or switch to Plain ASCII.
9. **Back up your notes!** Copy the folder periodically, or choose a folder in the cloud service. A synced folder also doubles as a backup. "Delete all data" can't be undone inside the program.
10. **Notes are plain text, not encrypted.** DOSchedule NEVER connects to the internet, but anyone who can open your computer or your synced folder can read your notes. Don't store passwords or bank details in it, and get the program only from its official page: https://github.com/liberteer/DOSchedule.

## Writing entries

| You type                      | Result                                                   |
|-------------------------------|----------------------------------------------------------|
| `x Buy ice cream`             | task                                                     |
| `o See the dentist 14.3.2026` | event on 14 March 2026                                   |
| `- check that website`        | note                                                     |
| `x!!! text`  `x!! text`  `x! text` | high / medium / low priority (red, yellow, green) |

A line above the command line shows **exactly how your entry will be read** before you press Enter. Ticked entries sink to the bottom, greyed out. Press Enter on a ticked entry to un-tick it.

**Dates** go anywhere in the text. No date means today (or the highlighted day on a calendar):

```
tomorrow    >fri    in 3 days    in 2 weeks
14.3.2026   14.3.26   3/14/26   2026-03-14
march 14    mar 14th   14 march
```

A day of the week needs a `>` in front (`o Lunch >fri`), so ordinary words like "Sat" or "Sun" in your text stay text.

**Event times** work on events only: `o Dentist 14:30`, `o Dentist 14:30-15:30`, `o Call 2pm`, `o Lunch at 12:30`. Events are sorted by time, and events without a time come first.

**Symbols:** colour emoji are not supported, because DOSchedule draws a DOS screen. They are ignored when you type or paste them, and shown as `?` if a notes file contains them. The classic DOS symbols work, for example ☺ ♥ ♪ ► ■: press **Windows key + .** and open the **Ω** (symbols) tab, or copy and paste them. Alt+number codes don't work in the terminal: Alt+3, for example, arrives as Ctrl+C and quits DOSchedule.

**Deadline tasks:** `>` is the deadline, `@` are the work days. Each work day is a separate session that you tick off by itself.

```
x!!! Write a review >fri @wed @thu       deadline Friday, work Wednesday and Thursday
x!!! Write a review >fri @2d             the 2 working days before the deadline
x Gym @mon,wed,fri                     no ">": the deadline is the last work day
```

It shows on the main list on each work day (`due Fri 16 Oct`) and from the deadline on (red when overdue). Ticking on a work day ticks that session; ticking the last session, or ticking on the deadline day, finishes the whole task. Deleting on a work day deletes that session; on the deadline day it deletes the whole task. 

To move a session, look at that day, press **F2**, press **Ctrl+W** to remove the day, type the new one (`@thu`) and press Enter.

## The screens

**Tab** goes main list, month, week (**Shift+Tab** goes back). Typing at the bottom adds an entry on all three.

* **Main list (today):** today's tasks, **overdue** tasks (date in red), deadline tasks on their work days, today's events, and notes from today and the last 7 days (you can change this in the options). Entries for other days are saved and shown on the calendars.
* **Month calendar:** weeks start on Monday. Arrows move the highlighted day, **PgUp / PgDn** change month, **Ctrl+T** jumps to today, **Enter** opens the day's list. Typing adds to the highlighted day.
* **Week calendar:** the highlighted day is a wide column with everything in full. Left / Right change day, Up / Down select an entry, **PgUp / PgDn** change week.

## Find

Press **/** (or **Ctrl+F**) and type. All words must match, in any order, and capitals and accents don't matter (`cuprija` finds "ćuprija"). Up / Down choose, **Enter** goes there, **Esc** closes.

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

If the terminal doesn't support Ctrl+F, use `/`.

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

If you edit a file by hand, keep its first line (`# 2026-03`) and save it as UTF-8 text. Otherwise DOSchedule leaves that file alone and tells you so when it starts.

## License and author

DOSchedule is free software under the [MIT License](LICENSE): you may use, copy, change and share it.
Copyright (c) 2026 Arnel Šarić Sharan (dukkhat).

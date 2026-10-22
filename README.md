# DOSchedule

**DOSchedule** is DOS/ASCII-themed planner for your terminal. Tasks, events and notes go into one simple list, with a month calendar and a week calendar behind it. Your notes are saved as plain text files (Markdown) on your own computer. I designd **DOSchedule** to help me solve one problem - continous switching between different apps, calendars, notes, etc.

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

## What you need

[Node.js](https://nodejs.org) version 18 or newer, which is free.
To check that you have it, type `node --version` in a terminal.

## Start it

1. Download this project (green **Code** button, then **Download ZIP**) and unzip it anywhere.
2. Open a terminal in the unzipped folder and type:

```
node doschedule.js
```

On Windows you can also double-click `doschedule.cmd`.

That's all. Your notes are saved by themselves; nothing to set up. To leave, press **Ctrl+Q**.

**Windows may warn about an "Unknown publisher".** When you double-click `doschedule.cmd` from a downloaded ZIP,
Windows may say "Windows protected your PC" or "The publisher could not be verified". It does that for any
file from the internet that isn't digitally signed, and DOSchedule is a free hobby project without a paid signing
certificate. Nothing is wrong with the file; you can read every line of it. You have three ways around it:

* Click **More info**, then **Run anyway** (or **Open**, or **Run**).
* Or start it from a terminal with `node doschedule.js`, which doesn't ask at all.
* Or, before unzipping, right-click the ZIP file, choose **Properties**, tick **Unblock** and click OK. Files
  unzipped afterwards won't be questioned.

**Where are my notes?** By default in your own user folder. On Windows that is
`C:\Users\<your name>\AppData\Roaming\DOSchedule` (the `AppData` folder is hidden; type `%APPDATA%` in the
Explorer address bar to get to `Roaming`). To keep them somewhere else, for example in Dropbox so that your computers share
them, press **F10** and choose **Choose notes folder...** (see [Options](#options-f10-or-ctrlo)). To back up your
notes, copy that folder.

## Your first minute

Type at the bottom of the screen and press **Enter**:

| You type                        | You get                                         |
|---------------------------------|-------------------------------------------------|
| `x Buy ice cream`               | a task                                          |
| `o Dentist tomorrow 14:30`      | an event, tomorrow at 14:30                     |
| `- Ask Sam about the trip`      | a note                                          |

Then try these:

* **Up / Down** select an entry, **Enter** on an empty line ticks it off.
* **Tab** switches between the main list, the month calendar and the week calendar.
* **/** searches everything you ever wrote. **?** shows help. **F10** opens the options. **Ctrl+Q** quits.

## Adding entries

The first character picks the type (capitals work too):

| You type                         | Result                                   |
|----------------------------------|------------------------------------------|
| `x Buy ice cream`                | task `[ ]`                               |
| `o See the dentist 14.3.2026`    | event on 14 March 2026                   |
| `- check that website`           | note                                     |
| `x!!! text`  `x!! text`  `x! text` | priority high / medium / low (the `!` goes right after the symbol) |

* A line above the command line shows **exactly how your entry will be read** (type, priority, date) before
  you press Enter.
* Priority 3 is red, 2 is yellow, 1 is green. Higher priority is listed first.
* **Ticked entries sink to the bottom** of their group, greyed out. Open entries stay above them, with the
  highest priority first. After you tick something the cursor stays on its row, so the next entry moves up under
  it and you can tick a whole run with Enter. Press Enter on a ticked entry to un-tick it.
* The main screen lists **Tasks, then Events, then Notes**.

### Dates

Put a date anywhere in the text. With no date, the entry is for today (or, on a calendar, for the highlighted day).

| Format                                         | Meaning                         |
|------------------------------------------------|---------------------------------|
| `14.3.2026`  `14. 3. 2026`  `14.3.26`          | day.month.year                  |
| `3/14/26`  `3/14/2026`                         | month/day/year                  |
| `2026-03-14`                                   | year-month-day                  |
| `march 14 2026`  `mar 14th`  `14 march`        | month names (English)           |
| `today`  `tomorrow`  `in 3 days`  `in 2 weeks` | relative                        |

* A month name without a year (`march 14`) means the next time that day comes around.
* If a date only makes sense one way round (`14/3/26`), that way is used. `3/4/26` is March 4.
* Things that could just be normal text are left alone: `3/14` and `2.5` without a year, `friday` on its own.
  An impossible date such as `31.2.2026` is refused with a message.
* Words like `on`, `by`, `due`, `until` directly before a date are dropped from the text.

### Event times

Events can have a start time and an optional end time, anywhere in the text:

```
o Dentist 14:30               o Dentist 14:30-15:30        o Standup 9:00 to 9:15
o Call 2pm                    o Call 2:30pm-4pm            o Lunch at 12:30
o Workshop >fri 9:00          o Dentist 14.3.2027 14:30
```

* Only **events** (`o`) take times. In a task or note, "at 10:30" just stays in the text, and the preview tells you.
* A time needs a colon (`14:30`) or am/pm, so `chapter 2` and `room 14` stay text. An impossible time
  (`25:00`) or an end before the start is refused.
* Within a day, events are sorted by time. Events without a time ("all day") come first.
* To make a timed event all-day again, press F2 and delete the time at the end of the line.

### Deadline tasks: `>` for the deadline, `@` for work days

A **deadline task** has a day it must be finished and earlier days on which you will work on it. Each work day is
its own **session** that you tick off separately.

```
x!!! Write report >fri @wed @thu       deadline Friday, work Wednesday and Thursday
x!!! Write report >fri @wed,thu        the same (a comma list, no spaces)
x!!! Write report >fri @wed-thu        a range of weekdays (Mon-Fri only)
x!!! Write report >fri @2d             the 2 working days before the deadline
x Slides >fri+1w @2d                   Friday of next week
x Taxes >april 15 @2d                  any date form works after > and @
x Gym @mon,wed,fri                     no ">": the deadline is the last work day
```

| After `>` or `@`                                | Meaning                                              |
|-------------------------------------------------|------------------------------------------------------|
| `fri`  `friday`                                 | after `>`: the nearest upcoming Friday (today counts) |
| `fri+1w`                                        | that Friday plus one week                            |
| `today`  `tomorrow`  `+3d`  `+2w`               | counted from today                                   |
| `16.10.`  `10/16`                               | day.month. or month/day, the next time it comes round |
| `16.10.2026`  `10/16/26`  `2026-10-16`  `march 14` | the usual date forms (spaces are fine here)       |
| `@wed` (with a `>` deadline)                    | the latest Wednesday between today and the deadline  |
| `@2d`                                           | the N working days (Mon-Fri) before the deadline     |

* **Where it shows:** on the main list on each work day (labelled `due Fri 16 Oct`) and from the deadline on (red
  once due or overdue). On other days it stays hidden. On the calendars it appears on every work day (`•`) and on
  the deadline (`■`).
* **Ticking (Enter) works per day.** On a work day it ticks only that day's session; the other days stay open.
  Ticking the last open session finishes the whole task. On the deadline day (or when overdue) it finishes the
  whole task at once. Ticking a finished task again reopens it.
* **Deleting (Del or Ctrl+D) acts on the day you are on, and asks first.** On a work day it deletes only that
  work session. On the deadline day it deletes the whole task with all its sessions.
* **Moving a work session.** Look at the work day you want to move and press **F2**. The task loads into the command
  line with that work day last:

  ```
  x!! Write report >2026-10-16 @2026-10-15 @2026-10-14      (you were on Wed 14)
  ```

  Press **Ctrl+W** (it deletes exactly `@2026-10-14`), type the new day (`@thu`, `@mon`, `@19.10.` ...) and press
  Enter. Typing nothing removes the session. Esc cancels. F2 on the deadline day loads the same line in natural
  order, so you can change the text, the priority, the deadline or any day.
* `>` and `@` only count at the start of a word with a date after it, so `bob@example.com`, `a>b` and `@john`
  stay normal text. Mistakes get a message instead of a guess: a work day after the deadline, `@sat` before a
  Friday deadline, `@5d` with only 4 working days left.

## The screens

Press **Tab** to go from the main list to the month calendar to the week calendar and back (**Shift+Tab** goes the
other way). Typing at the bottom works on the main list and on both calendars.

### Main list: today

The main list is for **today**:

* **Tasks:** open tasks dated today, **overdue** ones (shown with their date in red, so nothing is forgotten), tasks
  you finished today, and deadline tasks on their work days. Tasks for the future are saved but stay hidden until
  their day.
* **Events:** today's events only, sorted by time. Other days are on the calendars.
* **Notes:** today and the last 7 days (you can change this in the options), never notes for the future.

A long entry is never cut off: it continues on as many rows as it needs. If you add or edit an entry for another
day, it is saved but doesn't appear here, and the message says "(not on today's list)". Everything is still in the
calendars.

### Month calendar

* Weeks start on **Monday**. The highlighted day is a coloured block; `*` marks today.
* Each day cell shows its tasks and events (`•` task, `x` done, `o` event, `ø` event that has passed), coloured by
  priority, with `+N more` when they don't fit. A taller terminal shows more lines. Notes are not drawn in the
  cells, but the panel on the right lists the highlighted day in full, notes included.
* **Typing adds to the highlighted day**, unless the text has its own date (then the calendar jumps to it).
  `tomorrow` and `in 3 days` still count from the real today.

| Key                | Action                                                                       |
|--------------------|------------------------------------------------------------------------------|
| Arrows             | move the highlighted day (Up/Down = a week, Left/Right = a day)             |
| PgUp / PgDn        | previous / next month                                                        |
| Ctrl+T             | jump to today                                                                |
| Enter (empty line) | open the day panel; then Up/Down select, Enter ticks, F2 edits, Del deletes  |
| Esc or Left        | leave the day panel                                                          |

Needs a terminal of at least 70 x 16 characters.

### Week calendar

The week containing the highlighted day (Monday to Sunday). Month and week share the highlighted day, so
switching between them keeps your place. The **highlighted day is a wide column** showing everything in full; the
other six days are one-line overviews.

| Key                | Action                                                         |
|--------------------|----------------------------------------------------------------|
| Left / Right       | previous / next day (rolls into the neighbouring week)         |
| Up / Down          | select an entry of the highlighted day                         |
| PgUp / PgDn        | previous / next week                                           |
| Enter (empty line) | tick a task / mark an event as passed                          |
| F2, Del, Ctrl+T    | edit, delete, jump to today                                    |

Needs a terminal of at least 76 x 16 characters.

## Find

Press **/** on an empty command line (or **Ctrl+F**) and start typing. Results appear at once.

* All the words you type must be in the entry, in any order. **Capitals and accents don't matter**: `zare` finds
  "Žare", `cuprija` finds "ćuprija". The time of an event is searched too (`14:30`).
* Results show the marker, the date and the text, newest day first (up to 200). Finished tasks and past events are
  included, so you can find old things. The full text of the highlighted result is shown at the bottom.
* **Up / Down** choose a result, **Enter** goes there, **Esc** closes. Find never changes anything.
* Entries that belong on today's list open on the main list; everything else opens on the **week calendar, on its
  own day**.

## All keys

| Key                        | Action                                                             |
|----------------------------|--------------------------------------------------------------------|
| Tab / Shift+Tab            | next / previous screen: main list, month, week                     |
| Up / Down, PgUp / PgDn     | select an entry (main list)                                        |
| Enter (empty line)         | tick a task / mark an event as passed `ø` (again to undo)          |
| Enter (with text)          | add the entry (or save it while editing)                           |
| F2 or Ctrl+E               | edit the selected entry in the command line                        |
| Del or Ctrl+D              | delete the selected entry (asks y/n)                               |
| Esc                        | clear the command line / cancel an edit                            |
| `/` (empty line) or Ctrl+F | find                                                               |
| `?` (empty line) or F1     | help                                                               |
| F10 or Ctrl+O              | options                                                            |
| Ctrl+Q                     | quit                                                               |

On the command line: Left/Right, Home/End, Backspace, Del, Ctrl+U (clear to the start), Ctrl+W (delete a word).

*In the VS Code terminal Ctrl+F belongs to VS Code, so use `/` to open Find.*

## Options (F10 or Ctrl+O)

The bottom bar of every screen reminds you of **F10 options**. Up/Down pick a row, Left/Right (or Enter) change it,
Esc closes. Every change applies and is saved at once. The screen also shows where your notes are saved.

| Option                              | Choices                                                           |
|-------------------------------------|-------------------------------------------------------------------|
| **Color scheme**                    | Classic (default), Blue, Amber, Green, Light                      |
| **Frame style**                     | DOS lines (default), Plain ASCII                                  |
| **Notes on the main list**          | today only, today and yesterday, 3, **7 (default)**, 14, 30 days, or all |
| **Start with**                      | Main list (default), Month calendar, Week calendar                |
| **Choose notes folder...**          | pick where your notes are saved                                   |
| **Use the automatic notes folder**  | go back to the default folder                                     |
| **Delete all data...**              | delete every entry (asks twice)                                   |

| Scheme  | Look                                                                          |
|---------|-------------------------------------------------------------------------------|
| Classic | light grey on black, cyan frame                                               |
| Blue    | bright cyan on blue, like Norton Commander and Turbo Pascal                   |
| Amber   | an amber monochrome monitor                                                   |
| Green   | a green phosphor monitor                                                      |
| Light   | black on light grey, for bright rooms                                         |

**Frame style:** *DOS lines* draws the frames with DOS line-drawing characters. If your terminal or font shows `?`
or boxes instead, or you connect over SSH, choose *Plain ASCII*: the same screens drawn with keyboard characters
only. It changes only how things look, never your notes.

### Choose notes folder

Opens a folder browser in the style of an old DOS file manager: the folders of the current folder on the left, a look
inside the highlighted one on the right. **The folder shown at the top is the one that will be used.**

| Key                                | What it does                                                         |
|------------------------------------|----------------------------------------------------------------------|
| Up / Down, PgUp / PgDn, Home / End | move through the folders                                             |
| Enter (or Right)                   | open the highlighted folder; on `[..]` go one level up               |
| Backspace (or Left)                | one level up (on Windows, above a drive you get the list of drives: type a letter to jump) |
| **Space**                          | **use the folder shown at the top** for your notes                   |
| N (or F7)                          | make a new folder inside the current one                             |
| T                                  | type a path (`~` is your home folder; a missing last folder is created) |
| Esc                                | close without changing anything                                      |

After Space you get one question. If you have notes and the folder has none: **Copy my notes** (the default),
**Start empty**, or **Cancel**. If the folder already holds notes, you can **use those notes**. **Nothing is ever
moved or deleted**: your old notes stay where they were, and your settings (colour scheme and so on) are copied
along with your notes. The choice is remembered, so double-clicking or typing `node doschedule.js` always opens
the right notes.

**To go back:** Options, **Use the automatic notes folder**. Or, from a terminal, `node doschedule.js --reset-folder`.
If a chosen folder is not available when you start (a drive that isn't connected), the program tells you and shows
these two ways out, instead of opening an empty planner.

### Delete all data

The last row of the options. Enter on it opens a popup that says how much would go ("3 entries in 3 files"), with
**[ Yes ]** and **[ No ]**. Saying Yes opens a **second** popup, "Are you absolutely sure?". Only a second Yes deletes.

* **[ No ] is highlighted by default on both popups**, so pressing Enter twice can never delete anything.
  Left/Right switch the button, **Y** and **N** answer directly, **Esc** means No.
* It deletes all your entries. Your options stay. It cannot be undone inside the app (in Dropbox, the version
  history can bring files back for a while).

## Command line

```
node doschedule.js                            start the planner
node doschedule.js --where                    show which folder holds your notes
node doschedule.js --reset-folder             forget the folder chosen in the options
node doschedule.js --data D:\notes\doschedule use another notes folder for this run
node doschedule.js --help                     list these
```

* If a folder named `data` sits next to the program, DOSchedule uses it. That is handy for a USB stick, or when the
  program and its notes live together in Dropbox.
* `--data` (or the `DOSCHEDULE_DIR` environment variable) beats everything else, which is useful for scripts.

## Your notes are plain files

One Markdown file per month, with one section per day. You can read them in any text editor and back them up by
copying the folder:

```markdown
# 2026-03

## 2026-03-14 Saturday
- [ ] !!! Buy ice cream
- [x] Pay rent
- [o] 14:30-15:30 Dentist
- [ø] 12:30 Lunch with Sam
- [-] Check that website
- [ ] !! Write report (work 2026-03-12, 2026-03-13; done 2026-03-12)
```

`[ ]` open task, `[x]` done, `[o]` event, `[ø]` event that has passed, `[-]` note, and `!` / `!!` / `!!!` priority.
Everything is saved after every change. You may edit the files by hand: lines the program doesn't understand are kept.

## License and author

DOSchedule is free software under the [MIT License](LICENSE): you may use, copy, change and share it.
Copyright (c) 2026 Arnel Šarić Sharan (dukkhat).

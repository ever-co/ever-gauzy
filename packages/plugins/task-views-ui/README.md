<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-task-views-ui",
      "## Switch",
      "## What it shows",
      "## Keyboard",
      "## Tests"
    ]
  }
}
-->

# @gauzy/plugin-task-views-ui

The Angular side of the platform's task views extensions (spec
`docs/specs/features/task-views-and-bulk-actions/`, plan section 8): saved
and built-in views of tasks, bulk actions with undo, keyboard shortcuts, and
`KEY-123` task references.

## Switch

The UI has no switch of its own. It follows the API:

- Everything below appears only after the API has answered
  `GET /api/tasks/built-in/mine` (one task) for the signed-in user in the
  selected organization. The API serves that route only when
  `GAUZY_TASK_VIEWS_ENABLED=true`. Where it does not (the default), the app
  looks exactly as before: no Tasks → Views entry, no Settings → Keyboard
  shortcuts entry, no key listener, no reference chip. A temporary failure
  (5xx, network) is retried with a growing delay, then asked again every 5
  minutes, at most 6 times; 404, 401 and 403 are final.
- The routes `/pages/task-views` and `/pages/settings/keyboard-shortcuts`
  always exist. Opened on an installation without the extensions, they say
  so.

## What it shows

- **Views switcher:** the four built-in views the platform computes in the
  caller's time zone (my tasks, this week, overdue, due soon), then the saved
  views by where they belong: mine (personal), team, project, organization.
- **A saved view:** its tasks from `GET /task-views/:id/tasks`, a page of 50
  at a time (Load more follows the cursor). The **filter-tree editor** edits
  conditions on status, priority, size, labels, assignees, project, team,
  sprint and the dates (relative windows included), joined by "all of" or
  "any of", with nested groups; an edit applies at once and is kept as unsaved
  until Save. **Group by** shows the platform's counts in the group headers.
  The conditions the platform could not apply (a deleted label, an unknown
  field) are shown on their condition, each removable.
- **Save, Save as, Rename, Share / Make personal, Delete.** A save states the
  version it read; when someone saved meanwhile the platform answers 409 and
  the page shows the conflict with **Reload** (their version, the edit
  dropped) and **Overwrite** (the edit again, on their version). Saving keeps
  the keys another client stores in the view's columns.
- **Manual order:** a saved view ordered by hand, ungrouped, takes drag and
  drop; the drop sends the whole order with the version read.
- **Bulk actions:** checkboxes, Shift-click for a range, the page checkbox
  for every row of the page; the selection holds at most 100 tasks (the
  platform's limit). The toolbar sets status, priority, size, project and due
  date, adds or removes assignees and labels, and archives, in one
  `POST /tasks/bulk-update`; refused tasks are named, and **Undo** (10 s)
  sends the previous values the platform answered back. Delete asks first and
  deletes one task at a time (it cannot be undone).
- **References:** the rows and the task's own page (the `task-view-actions`
  slot, with copy) show `KEY-123`: the project key and the number, else the
  stored prefix. The go-to box takes a reference, a task id or a task link and
  opens the task through `POST /tasks/resolve-references`; it says when a
  reference names nothing the reader may see, names tasks of several projects,
  or moved (the task opens, the note names its reference today).

## Keyboard

One registry (`keyboard/shortcut-registry.ts`) holds every command, its
context and its default binding, in the syntax and with the command ids of
Ever Teams; the person's overrides are stored in
`uiPreferences.keyboard.bindings`, so a rebinding follows them to every
device and to Ever Teams. Ids this client does not know are kept on save.

- `?` the help; `G` then a letter goes somewhere (`G T` tasks, `G V` views,
  `G M` my tasks, `G W` this week, `G O` overdue, `G I` inbox, `G C` chat,
  `G D` documents, `G H` dashboard, `G P` projects, `G S` timesheets, `G R` go
  to a task by its key); `Mod+,` settings.
- On the views page: `J` / `K` (and the arrows) move, `X` selects (`Shift+X`
  a range, `Shift+J` / `Shift+K` extend), `Enter` or `O` opens, `Esc` clears,
  `S` / `P` / `L` / `D` open the toolbar's status, priority, labels and due
  date for the selection (or the focused row), `Mod+S` saves the view.
- Keys typed into fields and editors are left alone (a ⌘/Ctrl chord aside),
  and while a dialog is open only `?` runs.
- The header's Quick Actions bind single letters too. The registry listens
  first (window, capture phase) and takes a key only when one of its commands
  can run now, so `J` creates a project everywhere but on the views page. `G`
  starts a sequence: when no sequence key follows within 1.2 s, the Quick
  Action bound to `G` runs (`QuickActionShortcutBridge` in `ui-core/core`).
- Settings → Keyboard shortcuts records a new binding (one key, or two in a
  row), refuses the browser's own keys and the list's built-in keys, shows
  clashes, and restores a default or every default.

## Tests

Jest specs beside the models (`filter-tree`, `selection`, `bulk-undo`,
`view-conflict`, `view-definition`, rows and references), the registry
(`shortcut-registry`, `shortcut-recorder`, `shortcut-registry.service`) and
the plugin's entry points.

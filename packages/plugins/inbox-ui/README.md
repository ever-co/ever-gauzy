# @gauzy/plugin-inbox-ui

The Angular side of the Gauzy **Inbox** ([`@gauzy/plugin-inbox`](../inbox/README.md)): one page for everything addressed to
me, plus an unread badge in the header.

Plan: `ever-co/homelab` `docs/superpowers/specs/2026-10-15-gauzy-ever-works-integration/04-inbox-and-email.md` §1 (G-P3-2).

## Switch

The UI has no switch of its own. It follows the API:

- The nav entry and the header badge appear only after the API has answered `GET /api/inbox/items/counts` for the signed-in
  user. The API serves that route only when `GAUZY_INBOX_ENABLED=true` loads `@gauzy/plugin-inbox`. Where it does not (the
  default), the app looks exactly as before.
- The route `/pages/inbox` (permission `INBOX_VIEW`) is always registered. Opened on an installation without the Inbox, the
  page only says that the Inbox is off.

## What it shows

- **Tabs:** All, Decisions (open questions, approvals and escalations), Email, **Notifications** and Archived. The
  Notifications tab reads Gauzy's own `EmployeeNotification`s live from `/api/employee-notification` for the signed-in user's
  employee. This is their first Angular UI; nothing is copied into the Inbox.
- **Filters:** kind, source, unread only, and text search.
- **Detail pane:**
    - **Question:** the item's options (the recommended one highlighted) and a free-text reply. When the item asks for a
      reason, the reply needs text.
    - **Approval:** Approve / Reject (or the item's own options), with a note.
    - **Escalation:** what was tried, the decision needed and the confidence (from the item's `metadata`), with a resolve note.
    - **Notice:** read-only.
    - **Email:** a viewer in a **sandboxed `<iframe srcdoc>`**:
        - `sandbox=""` grants nothing: no scripts, no same-origin access, no forms, no navigation.
        - The document carries its own Content-Security-Policy, which blocks every fetch, including remote images.
        - The message is never put into the app's DOM, and `bypassSecurityTrustHtml` is never used.
        - The email HTML from P4 plugs into the same viewer.
- **Per item:** mark read / unread, archive / unarchive, snooze (an hour, until tomorrow, until next week, or wake it now),
  and open the linked task, project or agent.
- **Replies** go to the API, which delivers them to the item's source synchronously. A refusal from the source, such as
  "Already decided in Ever Works" (409), is shown in the reply pane, and the item is read again.
- **Header badge:** a bell with my unread count. It is read every 60 s (and not while the tab is hidden), and again at once
  after the page changes an item. It stops on 404 or 403.

The badge is a header action: `NavigationBuilderService.registerHeaderAction` in `@gauzy/ui-core/core` is the extension
point. The header renders plugins' actions after its own.

## Tests

`yarn nx test plugin-inbox-ui` covers:

- the helpers (tabs, reply checks, the Approve / Reject defaults, escalation details, snooze times, links);
- the services' requests;
- the email viewer's sandbox and policy;
- the badge's polling (at once, every 60 s, after a change, stopping on 404);
- the plugin's registration: the route always, the nav entry and the badge only where the API serves the Inbox.

`yarn nx test ui-core` covers the header-action registry.

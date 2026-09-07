# Changelog for @gauzy/plugin-dashboard-time-track-react-ui

## [Unreleased]

### Changed

- **Full parity with the Angular Time Tracking dashboard.** The page now renders the same
  header (period-prefixed `ngx-header-title`, timezone / time-format filter, "Manage widgets"
  popover with Undo, Auto Refresh toggle + Refresh), the six counter widgets with
  `gauzy-counter-point` strips, and the six windows (Recent Activities with screenshot carousel /
  gallery / info modal / delete, Manual Time, Tasks, Projects, Apps & URLs, Members) — each with
  the ⋮ Collapse / Expand / Move / Delete menu and drag & drop reordering.
- Widget/window layout (order, hidden, collapsed) is read from and written to `Store.widgets` /
  `Store.windows` in the Angular record shape, so Angular ↔ React switches keep the layout.
- Data path mirrors `TimeTrackingComponent` (same seven `TimesheetStatisticsService` calls,
  payload, `combineLatest` + `debounceTime(500)`, skip-when-hidden, `Promise.allSettled`, toastr
  errors, per-panel spinners, 5-minute auto-refresh, `GalleryService.clearGallery()`).
- `RangePeriod` detection now matches Angular exactly (`days === 6 → WEEK`; the old `<= 6` is gone).
- i18n switched to the global `TIMESHEET.*` / `BUTTONS.*` keys (14 locales); hardcoded English
  label maps deleted. The `REACT_UI` namespace only carries "Undo".
- Theming: hardcoded light hexes replaced by an injected stylesheet transcribed from the Angular
  SCSS (theme CSS variables) + Nebular's global `nb-card` / `nb-list-item` / `[nbButton]` /
  `nb-icon` rules.
- `WidgetVisibilityChangedEvent` is now emitted (Manage-widgets toggles); `DashboardRefreshedEvent`
  fires on every counts refresh.
- Public API: exports the React building blocks, hooks and pure helpers next to the plugin.

### Removed

- The plugin `settings` block (`showMembersWorked` … `refreshInterval`) and `usePluginSettings`
  usage — widget visibility now lives in the Manage-widgets popover like Angular, and the interval
  is the Angular-fixed 5 minutes.
- The dead `REACT_UI.DASHBOARD_PAGE.TABS.REACT_TIME_TRACKING` key.

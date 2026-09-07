# @gauzy/plugin-dashboard-time-track-react-ui

The **React flavour** of the Time Tracking dashboard (`/pages/dashboard/time-tracking`). It renders the same dashboard as `@gauzy/plugin-dashboard-time-track-angular-ui` — same features, layout, widgets, windows, popovers, i18n, theming and navigation targets — built with React 19 through the `@gauzy/ui-react` bridge, on top of `@gauzy/plugin-ui` and `@gauzy/ui-react-components`.

Which flavour a tenant gets is decided by **Settings → General → "Preferred UI"**: both plugins register the same route path behind a `preferredUiCanMatch(...)` guard and contribute the same `time-tracking` dashboard tab, so bookmarks and the tab never change when a tenant switches.

## Architecture

```
@gauzy/plugin-ui                 (core plugin infrastructure, Angular-only)
       │
       └── @gauzy/ui-react       (React-to-Angular bridge: [gaReactHost], useInjector, useObservable, useTranslation, …)
                  │
                  ├── @gauzy/ui-react-components   (theme-adaptive React primitives: CounterPoint, ProgressBar, Badge, Avatar, Spinner, Popover)
                  │
                  └── @gauzy/plugin-dashboard-time-track-react-ui   (this plugin)
```

**Page chrome via the Angular host, everything else React.** `DashboardTimeTrackReactUiPageComponent` (Angular, routed) renders the standard `nb-card` with the `<h4><ngx-header-title>` title (period prefix "Daily / Weekly / Monthly" + "Time Tracking" + " for <Org>" + breadcrumb trail) and mounts the React root **once** in the card body via `[gaReactHost]`. The React root portals the header controls (timezone / time-format filter, "Manage widgets", "Auto Refresh", "Refresh") into two header slots passed in `props`, and renders the widget row and the window masonry in the body.

Angular services are reused through the injector, so the data path is identical to the Angular tab: `TimesheetStatisticsService` (`getCounts`, `getTimeSlots`, `getActivities`, `getProjects`, `getTasksStatistics({ take: 5 })`, `getManualTimes`, `getMembers`), `Store`, `DateRangePickerBuilderService`, `TimeZoneService`, `NavigationService`, `GalleryService`, `NbDialogService` (gallery, screenshot info modal, delete confirm), `TimesheetService` (delete), `Router`, `EmployeesService`, `OrganizationProjectsService`, `ToastrService`, `NgxPermissionsService`, `NbIconLibraries`.

## Features (parity with the Angular tab)

- **Widgets** (counter cards with `gauzy-counter-point` dot strips / progress bars): Members worked, Projects worked, Today's Activity, Worked today, Worked this week / for the week / for the day / over the period, Weekly / Daily Activity — period-aware titles.
- **Windows**: Recent Activities (avatar + "Last worked", prev/next, "View All" → screenshots page, 3-per-view screenshot carousel with the shared gallery, info modal and delete-with-confirm), Manual Time (table + "View Report"), Tasks (`%` bars + "View All"), Projects (`%` bars), Apps & URLs (`ngx-activity-item` look + "View Report"), Members (today / this-week durations, activity badges, 7-bar weekly graph).
- **⋮ menu on every widget/window**: Collapse / Expand / Move / Delete; **drag & drop** reordering (native HTML5 DnD, no dependency).
- **Manage widgets popover**: "View widgets" / "View windows" checkmark lists + Undo (memento stack).
- **Same persisted layout as Angular**: order, hidden and collapsed state live in `Store.widgets` / `Store.windows` (localStorage `_widgets` / `_windows`) in the exact record shape the Angular `WidgetService` / `WindowService` write, so switching Angular ↔ React keeps the layout. Auto-hide rules mirrored: an employee selection hides "Members worked" + the Members window, a project selection hides "Projects worked".
- **Timezone / time-format selector**: port of `ga-timezone-filter` (UTC / Org / Mine, 12h / 24h), label built by the same helper, persisted as `?time_zone=` / `?time_format=` through `NavigationService.updateQueryParams`, pushed into `TimeZoneService` so the whole app agrees.
- **Data**: same payload as `preparePayloads()` (`toUtcOffset`, `getAdjustDateRangeFutureAllowed`, today bounds, `employeeIds` / `projectIds` / `teamIds`, `timeZone`), same `combineLatest` of the six Angular streams + `debounceTime(500)`, skip-when-hidden, `Promise.allSettled`, `ToastrService.error` on failure, per-panel spinners, `durationPercentage` / `weekHours` reshaping, `RangePeriod` detection exactly like Angular (`days === 6 → WEEK`, `0 → DAY`, else `PERIOD`), `period` capacity for the dot strips, `EmployeesService.getCount` / `OrganizationProjectsService.getCount`.
- **Auto-refresh**: 5 minutes, default ON; the Refresh button is disabled while it is on. `GalleryService.clearGallery()` on refresh and unmount.
- **Permissions**: `CHANGE_SELECTED_EMPLOYEE` gates the Members widget, the Members window and the avatar / "View All" bits.
- **i18n**: the global `TIMESHEET.*` / `BUTTONS.*` keys of the Angular tab (14 locales) via `useTranslation().t()`; the plugin's own `REACT_UI` namespace only carries "Undo".
- **Theming**: one injected `<style>` block (`gz-rtt-*` classes) transcribed from the Angular SCSS with theme CSS variables; cards / lists / buttons / icons reuse Nebular's global `nb-card`, `nb-list-item`, `[nbButton]`, `nb-icon` rules, so light / dark / corporate / material themes match.
- **Events**: `DashboardRefreshedEvent` (every counts refresh) and `WidgetVisibilityChangedEvent` (Manage-widgets toggles).

## Usage

```typescript
import { PluginUiConfig } from '@gauzy/plugin-ui';
import { DashboardTimeTrackReactUiPlugin } from '@gauzy/plugin-dashboard-time-track-react-ui';

export const uiPluginConfig: PluginUiConfig = {
  plugins: [DashboardTimeTrackReactUiPlugin]
};
```

## Source map

| Area | Files |
| --- | --- |
| Plugin / route / host | `src/lib/dashboard-time-track-react-ui.plugin.ts`, `dashboard-time-track-react-ui.routes.ts`, `dashboard-time-track-react-ui-page.component.ts` |
| Root React page | `src/lib/components/DashboardTimeTrackReactUiPage.tsx` (+ `styles.ts`) |
| Header controls | `src/lib/components/header/{TimezoneFilter,ManageWidgetsPopover,HeaderToolbar}.tsx` |
| Layout (DnD + ⋮ menu) | `src/lib/components/layout/DraggableLayout.tsx` |
| Widgets / windows | `src/lib/components/widgets/CounterWidget.tsx`, `src/lib/components/windows/*.tsx` |
| Hooks | `src/lib/hooks/use-time-tracking-context.ts`, `use-time-tracking-statistics.ts`, `use-dashboard-layout.ts`, `use-timezone-filter.ts`, `use-permission.ts` |
| Pure helpers (+ specs) | `src/lib/utils/{period,payload,timezone,format,layout,gallery}.utils.ts` |

## Development

```bash
yarn nx build plugin-dashboard-time-track-react-ui
yarn nx test plugin-dashboard-time-track-react-ui
```

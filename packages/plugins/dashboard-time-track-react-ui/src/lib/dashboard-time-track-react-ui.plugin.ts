import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, IPluginI18nService, PluginRouteInput } from '@gauzy/plugin-ui';
import { DASHBOARD_TIME_TRACK_ROUTE, DASHBOARD_TIME_TRACK_PATH } from './dashboard-time-track-react-ui.routes';
import en from '../i18n/en.json';

/**
 * React UI Plugin Definition — the React flavour of the Time Tracking dashboard.
 *
 * Renders the SAME dashboard as `@gauzy/plugin-dashboard-time-track-angular-ui` — title with
 * period prefix and breadcrumb, timezone / time-format selector, "Manage widgets" popover with
 * Undo, Auto Refresh + Refresh, the six counter widgets (Members worked, Projects worked, Today's
 * Activity, Worked today, Worked this week, Weekly Activity) and the six windows (Recent
 * Activities with the screenshot carousel and gallery, Manual Time, Tasks, Projects, Apps & URLs,
 * Members), each with its ⋮ Collapse / Expand / Move / Delete menu and drag & drop reordering —
 * built with React 19 through the `@gauzy/ui-react` bridge. Data, layout persistence
 * (`Store.widgets` / `Store.windows`), permissions, dialogs and navigation reuse the Angular
 * services via the injector, so a tenant can flip between the two flavours (Settings → General →
 * "Preferred UI") without losing state.
 *
 * Uses `defineDeclarativePlugin` — no Angular NgModule or manual service injection required.
 * Routes and tabs are registered automatically at bootstrap via the services provided to
 * `PluginUiModule.init()`.
 *
 * ## Features
 *
 * - **Versioning**: `version: '0.1.0'` — enables compatibility checks
 * - **i18n**: the global `TIMESHEET.*` / `BUTTONS.*` keys of the Angular tab (all 14 locales);
 *   the `REACT_UI` namespace only carries the one string that has no global key ("Undo")
 * - **Type-Safe Events**: `DashboardRefreshedEvent` (every counts refresh) /
 *   `WidgetVisibilityChangedEvent` (Manage-widgets toggles) in `dashboard-time-track-react-ui.events.ts`
 * - **Permissions**: Tab visibility gated by `ADMIN_DASHBOARD_VIEW` + `TIME_TRACKING_DASHBOARD`;
 *   the Members widget/window and the avatar/"View All" bits by `CHANGE_SELECTED_EMPLOYEE`
 * - **Preferred UI**: the route carries `preferredUiCanMatch(PreferredUiEnum.REACT)`, so it only
 *   matches when the tenant selected the React flavour; the tab is shared with the Angular plugin
 *
 * ## Usage
 *
 * Add to your plugin config:
 * ```typescript
 * import { DashboardTimeTrackReactUiPlugin } from '@gauzy/plugin-dashboard-time-track-react-ui';
 *
 * export const PLUGIN_UI_CONFIG: PluginUiConfig = {
 *   plugins: [DashboardTimeTrackReactUiPlugin]
 * };
 * ```
 */
export const DashboardTimeTrackReactUiPlugin = defineDeclarativePlugin('dashboard-time-track-react-ui', {
	// ── Versioning & Compatibility ────────────────────────────────
	version: '0.1.0',

	// ── Location ─────────────────────────────────────────────────
	location: 'page-sections',

	// ── Routes ───────────────────────────────────────────────────
	routes: [DASHBOARD_TIME_TRACK_ROUTE as PluginRouteInput],

	// ── Namespace-isolated translations ──────────────────────────
	// The dashboard itself uses the global `TIMESHEET.*` / `BUTTONS.*` keys (same as the Angular
	// tab). This bundle only carries strings that have no global key, wrapped under 'REACT_UI'
	// (English falls back for every other language, see `applyPluginTranslations`).
	translationNamespace: 'REACT_UI',
	translations: { en },

	// ── Dashboard Tab ────────────────────────────────────────────
	// Same `tabId`, title, icon, order and path as the Angular flavour: the tab registry
	// upserts by `tabId`, so both plugins contribute ONE "Time Tracking" tab, and the route
	// registrations behind it (`preferredUiCanMatch`) pick the flavour the tenant selected.
	tabs: [
		{
			tabsetId: 'dashboard-page',
			tabId: 'time-tracking',
			tabsetType: 'route',
			path: `/pages/dashboard/${DASHBOARD_TIME_TRACK_PATH}`,
			tabTitle: (_i18n: IPluginI18nService) => _i18n.getTranslation('TIMESHEET.TIME_TRACKING'),
			tabIcon: 'clock-outline',
			responsive: true,
			activeLinkOptions: { exact: false },
			order: 3,
			permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKING_DASHBOARD]
		}
	]
});

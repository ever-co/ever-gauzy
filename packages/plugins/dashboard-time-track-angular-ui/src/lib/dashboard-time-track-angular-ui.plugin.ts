import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, IPluginI18nService, PluginRouteInput } from '@gauzy/plugin-ui';
import { DASHBOARD_TIME_TRACKING_ROUTE, DASHBOARD_TIME_TRACKING_PATH } from './dashboard-time-track-angular-ui.constants';
import ar from '../i18n/ar.json';
import bg from '../i18n/bg.json';
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import fr from '../i18n/fr.json';
import he from '../i18n/he.json';
import it from '../i18n/it.json';
import nl from '../i18n/nl.json';
import pl from '../i18n/pl.json';
import pt from '../i18n/pt.json';
import ru from '../i18n/ru.json';
import zh from '../i18n/zh.json';

/**
 * Angular UI Plugin Definition for the Time Tracking dashboard tab.
 *
 * Registers the original Angular-based Time Tracking dashboard tab as a
 * standalone plugin, using `defineDeclarativePlugin`. Routes and tabs are
 * registered automatically at bootstrap via PluginUiModule.
 *
 * ## Usage
 *
 * Add to your plugin config:
 * ```typescript
 * import { DashboardTimeTrackAngularUiPlugin } from '@gauzy/plugin-dashboard-time-track-angular-ui';
 *
 * export const uiPluginConfig: PluginUiConfig = {
 *   plugins: [DashboardTimeTrackAngularUiPlugin]
 * };
 * ```
 */
export const DashboardTimeTrackAngularUiPlugin = defineDeclarativePlugin('dashboard-time-track-angular-ui', {
	// ── Versioning & Compatibility ────────────────────────────────
	version: '0.1.0',

	// ── Translations ────────────────────────────────────────────
	translations: { ar, bg, de, en, es, fr, he, it, nl, pl, pt, ru, zh },

	// ── Location ─────────────────────────────────────────────────
	location: 'page-sections',

	// ── Routes ───────────────────────────────────────────────────
	routes: [DASHBOARD_TIME_TRACKING_ROUTE as PluginRouteInput],

	// ── Dashboard Tab ────────────────────────────────────────────
	tabs: [
		{
			tabsetId: 'dashboard-page',
			tabId: 'time-tracking',
			tabsetType: 'route',
			path: `/pages/dashboard/${DASHBOARD_TIME_TRACKING_PATH}`,
			tabTitle: (_i18n: IPluginI18nService) => _i18n.getTranslation('TIMESHEET.TIME_TRACKING'),
			tabIcon: 'clock-outline',
			responsive: true,
			activeLinkOptions: { exact: false },
			order: 3,
			permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKING_DASHBOARD]
		}
	]
});

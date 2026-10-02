import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginNavItemInput, PluginRouteInput } from '@gauzy/plugin-ui';
import en from '../i18n/en.json';

/** Path of the settings page, relative to `/pages/settings`. */
export const USAGE_STATISTICS_PATH = 'usage-statistics';

/** Absolute link of the settings page. */
export const USAGE_STATISTICS_LINK = `/pages/settings/${USAGE_STATISTICS_PATH}`;

/**
 * `/pages/settings/usage-statistics`. The API decides what each person sees: the operator of the
 * installation gets the controls, everyone else "Managed by the instance operator".
 */
export const USAGE_STATISTICS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: USAGE_STATISTICS_PATH,
	loadComponent: () =>
		import('./components/usage-statistics-settings/usage-statistics-settings.component').then((m) => m.UsageStatisticsSettingsComponent),
	data: {
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: false
		}
	}
};

/**
 * Anonymous usage statistics UI plugin (`@gauzy/plugin-ever-stats-ui`): Settings > Anonymous usage
 * statistics. The menu entry is shown to tenant administrators; the page itself shows the controls
 * only to the operator of the installation.
 */
export const EverStatsUiPlugin = defineDeclarativePlugin('ever-stats', {
	version: '0.1.0',
	location: 'settings-sections',
	routes: [USAGE_STATISTICS_ROUTE],
	navMenu: [
		{
			type: 'section' as const,
			sectionId: 'settings',
			items: [
				{
					id: 'settings-usage-statistics',
					title: 'Anonymous usage statistics',
					icon: 'fas fa-chart-bar',
					link: USAGE_STATISTICS_LINK,
					data: {
						translationKey: 'EVER_STATS.MENU',
						permissionKeys: [PermissionsEnum.TENANT_SETTING]
					}
				} as PluginNavItemInput
			]
		}
	],
	permissionKeys: [],
	translationNamespace: 'EVER_STATS',
	translations: { en }
});

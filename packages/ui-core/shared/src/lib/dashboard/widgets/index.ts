import { ACCOUNTING_DASHBOARD_WIDGETS } from './accounting';
import { CHART_DASHBOARD_WIDGETS } from './charts';
import { HR_DASHBOARD_WIDGETS } from './hr';
import { TEAMS_DASHBOARD_WIDGETS } from './teams';

export * from './accounting';
export * from './charts';
export * from './hr';
export * from './teams';
export * from './provide-core-dashboard-widgets';

/**
 * Every dashboard-builder widget contributed by the core application
 * (as opposed to the ones plugins publish through their declarative
 * `widgets` field).
 *
 * Registered once at app start — see `provideCoreDashboardWidgets()`.
 */
export const CORE_DASHBOARD_WIDGETS = [
	...ACCOUNTING_DASHBOARD_WIDGETS,
	...HR_DASHBOARD_WIDGETS,
	...CHART_DASHBOARD_WIDGETS,
	...TEAMS_DASHBOARD_WIDGETS
];

import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { WidgetRegistryService } from '@gauzy/ui-core/core';
// Import the registration arrays from their own modules, NOT through the folder
// barrels: the barrels also export the widget component classes, which would
// drag every widget into the initial bundle and defeat their lazy loading.
import { ACCOUNTING_DASHBOARD_WIDGETS } from './accounting/accounting.widgets';
import { CHART_DASHBOARD_WIDGETS } from './charts/charts.widgets';
import { HR_DASHBOARD_WIDGETS } from './hr/hr.widgets';
import { PROJECT_MANAGEMENT_DASHBOARD_WIDGETS } from './project-management/project-management.widgets';
import { TEAMS_DASHBOARD_WIDGETS } from './teams/teams.widgets';

/**
 * Every dashboard-builder widget contributed by the core application, as
 * opposed to the ones plugins publish through their declarative `widgets` field.
 *
 * These are configuration objects only — each one's component is fetched on
 * demand by `WidgetRegistryService.resolveComponent()`, so a canvas only pays
 * for the widgets it actually renders.
 */
export const CORE_DASHBOARD_WIDGETS = [
	...ACCOUNTING_DASHBOARD_WIDGETS,
	...HR_DASHBOARD_WIDGETS,
	...CHART_DASHBOARD_WIDGETS,
	...TEAMS_DASHBOARD_WIDGETS,
	...PROJECT_MANAGEMENT_DASHBOARD_WIDGETS
];

/**
 * Publishes the core dashboard widgets (Accounting, HR, employee charts, Teams)
 * to the widget registry, so they appear in the dashboard builder's palette and
 * can be placed on any custom dashboard canvas.
 *
 * IMPORTANT: provide this at the ROOT (the bootstrap module).
 * `provideAppInitializer` inside a lazily-created child EnvironmentInjector
 * never runs — exactly the trap plugin widget registration hit.
 *
 * @returns Environment providers to spread into the root providers array.
 */
export function provideCoreDashboardWidgets(): EnvironmentProviders {
	return provideAppInitializer(() => {
		const registry = inject(WidgetRegistryService);
		for (const widget of CORE_DASHBOARD_WIDGETS) {
			// registerOrReplace, not register: idempotent under HMR and safe if a
			// future bundle re-registers the same id.
			registry.registerOrReplaceWidget(widget);
		}
	});
}

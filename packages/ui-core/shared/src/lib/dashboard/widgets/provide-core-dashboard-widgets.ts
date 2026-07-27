import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { WidgetRegistryService } from '@gauzy/ui-core/core';
import { CORE_DASHBOARD_WIDGETS } from './index';

/**
 * Publishes the core application's dashboard widgets (Accounting, HR, employee
 * charts, Teams) to the widget registry, so they appear in the dashboard
 * builder's palette and can be placed on any custom dashboard canvas.
 *
 * Plugins contribute their own widgets declaratively via the `widgets` field on
 * `defineDeclarativePlugin`; these are core-owned, so they are registered from
 * the application's ROOT injector instead.
 *
 * IMPORTANT: this must be provided at the root (e.g. in the bootstrap module).
 * `provideAppInitializer` inside a lazily-created child EnvironmentInjector
 * never runs — that is exactly the trap the plugin widget registration hit.
 *
 * @returns Environment providers to spread into the root providers array.
 */
export function provideCoreDashboardWidgets(): EnvironmentProviders {
	return provideAppInitializer(() => {
		const registry = inject(WidgetRegistryService);
		for (const widget of CORE_DASHBOARD_WIDGETS) {
			// registerOrReplace (not register): idempotent under HMR and safe if a
			// future bundle re-registers the same id.
			registry.registerOrReplaceWidget(widget);
		}
	});
}

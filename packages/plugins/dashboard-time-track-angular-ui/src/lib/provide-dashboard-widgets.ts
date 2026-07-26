import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { WidgetRegistryService } from '@gauzy/ui-core/core';
import { DASHBOARD_TIME_TRACK_WIDGETS } from './widgets/dashboard-time-track.widgets';

/**
 * Registers this plugin's Time Tracking widgets with the global widget
 * registry, so they appear in the dashboard builder's palette and can be
 * instantiated on any custom dashboard canvas.
 *
 * Registration happens at app initialization (before the first canvas renders)
 * and uses `registerOrReplaceWidget` semantics via `registerWidgets` so a
 * re-registration — e.g. after the plugin is toggled off and on again — never
 * throws on duplicate ids.
 *
 * @returns Environment providers to spread into the plugin's `providers`.
 */
export function provideDashboardTimeTrackWidgets(): EnvironmentProviders {
	return provideAppInitializer(() => {
		const registry = inject(WidgetRegistryService);
		for (const widget of DASHBOARD_TIME_TRACK_WIDGETS) {
			registry.registerOrReplaceWidget(widget);
		}
	});
}

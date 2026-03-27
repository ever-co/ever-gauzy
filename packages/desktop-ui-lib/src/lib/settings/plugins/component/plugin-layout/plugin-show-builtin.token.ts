import { InjectionToken } from '@angular/core';

/**
 * Injection token that controls whether the "Built-in" tab is shown in the plugin layout.
 * Default is false (not shown). The web app should provide `true` to enable it.
 */
export const PLUGIN_SHOW_BUILTIN = new InjectionToken<boolean>('PLUGIN_SHOW_BUILTIN', {
	providedIn: 'root',
	factory: () => false
});

import { inject, NgModule } from '@angular/core';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PageExtensionRegistryService,
	PluginUiDefinition,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PageRouteRegistryService, PageTabRegistryService } from '@gauzy/ui-core/core';

/**
 * React UI Plugin Module.
 *
 * Applies declarative registrations (extensions) defined in ReactUiPlugin.
 */
@NgModule({})
export class ReactUiModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _pageTabRegistryService = inject(PageTabRegistryService);
	private readonly _pageExtensionRegistryService = inject(PageExtensionRegistryService);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION, { optional: true }) as PluginUiDefinition | null;

	/**
	 * Called when the plugin bootstraps.
	 */
	ngOnPluginBootstrap(): void {
		console.log('[ReactUiModule] Plugin bootstrapped - React components are ready!');
		this._applyDeclarativeRegistrations();
	}

	/**
	 * Called when the plugin is destroyed.
	 */
	ngOnPluginDestroy(): void {
		console.log('[ReactUiModule] Plugin destroyed');
		ReactUiModule._hasAppliedRegistrations = false;
	}

	/**
	 * Applies routes, navMenu, and extensions from the plugin definition.
	 * Guarded to run once per app lifecycle.
	 */
	private _applyDeclarativeRegistrations(): void {
		if (ReactUiModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService,
			pageTabRegistry: this._pageTabRegistryService,
			pageExtensionRegistry: this._pageExtensionRegistryService
		});

		ReactUiModule._hasAppliedRegistrations = true;
		console.log('[ReactUiModule] Declarative registrations applied');
	}
}

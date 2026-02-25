import { inject, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PageExtensionRegistryService,
	PluginUiDefinition,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { ExampleReactPageComponent } from './example-react-page.component';

/**
 * Example React UI Plugin Module.
 *
 * Demonstrates how to create a plugin that uses React components rendered inside Angular.
 * This module applies declarative registrations for routes, navMenu, and extensions.
 */
@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild([
			{
				path: '',
				component: ExampleReactPageComponent
			}
		])
	]
})
export class ExampleReactUiModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _pageExtensionRegistryService = inject(PageExtensionRegistryService);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION as unknown as any, { optional: true }) as
		| PluginUiDefinition
		| null;

	/**
	 * Called when the plugin bootstraps.
	 */
	ngOnPluginBootstrap(): void {
		console.log('[ExampleReactUiModule] Plugin bootstrapped - React components are ready!');
		this._applyDeclarativeRegistrations();
	}

	/**
	 * Called when the plugin is destroyed.
	 */
	ngOnPluginDestroy(): void {
		console.log('[ExampleReactUiModule] Plugin destroyed');
		ExampleReactUiModule._hasAppliedRegistrations = false;
	}

	/**
	 * Applies routes, navMenu, and extensions from the plugin definition.
	 * Guarded to run once per app lifecycle.
	 */
	private _applyDeclarativeRegistrations(): void {
		if (ExampleReactUiModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService,
			pageExtensionRegistry: this._pageExtensionRegistryService
		});

		ExampleReactUiModule._hasAppliedRegistrations = true;
		console.log('[ExampleReactUiModule] Declarative registrations applied');
	}
}

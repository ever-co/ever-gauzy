import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PluginUiDefinition,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { PlaneApiKeyDialogComponent } from './components/api-key-dialog/api-key-dialog.component';
import { PlaneAuthorizeComponent } from './components/plane-authorize/plane-authorize.component';
import { PlaneSettingsComponent } from './components/plane-settings/plane-settings.component';
import { IntegrationPlaneLayoutComponent } from './integration-plane.layout.component';
import { getPlaneRoutes } from './integration-plane.routes';

const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbTooltipModule
];

@NgModule({
	declarations: [
		IntegrationPlaneLayoutComponent,
		PlaneApiKeyDialogComponent,
		PlaneAuthorizeComponent,
		PlaneSettingsComponent
	],
	imports: [
		...NB_MODULES,
		RouterModule.forChild([]),
		TranslateModule.forChild(),
		SharedModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: getPlaneRoutes,
			multi: true
		}
	]
})
export class IntegrationPlaneUiModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('IntegrationPlaneUiModule');
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION, { optional: true }) as PluginUiDefinition | null;

	// ─── Plugin Lifecycle ─────────────────────────────────────────

	/** Called by PluginUiModule after the plugin module is instantiated. */
	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
		this._applyDeclarativeRegistrations();
	}

	/** Called by PluginUiModule when the application is shutting down. */
	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
		this._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes and nav from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (this._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		this._hasAppliedRegistrations = true;
	}
}

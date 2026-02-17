import { inject, NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	DynamicTabsModule,
	NebularModule,
	SharedModule,
	SmartDataViewLayoutModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { JobEmployeeComponent } from './components/job-employee/job-employee.component';
import { JobSearchStatusEditorComponent } from './components/job-search-status-editor/job-search-status-editor.component';
import { JobSearchStoreService } from './providers/job-search-store.service';

@NgModule({
	declarations: [JobEmployeeComponent],
	providers: [JobSearchStoreService],
	imports: [
		RouterModule.forChild([]),
		NebularModule,
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		DynamicTabsModule,
		TableComponentsModule,
		JobSearchStatusEditorComponent
	]
})
export class JobEmployeeModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('JobEmployeeModule');
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION, { optional: true });

	constructor() {}

	// ─── Plugin Lifecycle ─────────────────────────────────────────

	/** Called by PluginUiModule after the plugin module is instantiated. */
	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
		this._applyDeclarativeRegistrations();
	}

	/** Called by PluginUiModule when the application is shutting down. */
	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
		JobEmployeeModule._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes and nav from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobEmployeeModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		JobEmployeeModule._hasAppliedRegistrations = true;
	}
}

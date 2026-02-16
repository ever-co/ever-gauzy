import { inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { BaseChartDirective } from 'ng2-charts';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PLUGIN_DEFINITION,
	PluginUiDefinition
} from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	SharedModule,
	SelectorsModule,
	TableFiltersModule,
	ContactSelectModule,
	ProposalTemplateSelectModule,
	CardGridModule,
	UserFormsModule,
	TableComponentsModule,
	TagsColorInputModule,
	NebularModule
} from '@gauzy/ui-core/shared';
import { getProposalsRoutes, JOB_PROPOSAL_SALES_ROUTE, SALES_SECTIONS_LOCATION } from './job-proposal.routes';
import { COMPONENTS } from './components';

@NgModule({
	imports: [
		RouterModule.forChild([]),
		CKEditorModule,
		NgSelectModule,
		TranslateModule.forChild(),
		NebularModule,
		BaseChartDirective,
		SharedModule,
		TagsColorInputModule,
		TableComponentsModule,
		UserFormsModule,
		CardGridModule,
		ProposalTemplateSelectModule,
		SmartDataViewLayoutModule,
		ContactSelectModule,
		TableFiltersModule,
		SelectorsModule
	],
	declarations: [...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (registry: PageRouteRegistryService) => getProposalsRoutes(registry),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobProposalModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('JobProposalModule');
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);

	constructor() {
		this._applyDeclarativeRegistrations();
	}

	// ─── Plugin Lifecycle ─────────────────────────────────────────

	/** Called by PluginUiModule after the plugin module is instantiated. */
	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
	}

	/** Called by PluginUiModule when the application is shutting down. */
	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
		JobProposalModule._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobProposalModule._hasAppliedRegistrations) return;

		const def: PluginUiDefinition =
			inject(PLUGIN_DEFINITION, { optional: true }) ??
			({
				id: 'job-proposal',
				location: SALES_SECTIONS_LOCATION,
				routes: [JOB_PROPOSAL_SALES_ROUTE]
			} as PluginUiDefinition);

		applyDeclarativeRegistrations(def, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		JobProposalModule._hasAppliedRegistrations = true;
	}
}

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
	PluginUiDefinition,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService, Store } from '@gauzy/ui-core/core';
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
import { getProposalsRoutes, JOB_PROPOSAL_PAGE_LINK } from './job-proposal.routes';
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
	private readonly _store = inject(Store);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION as unknown as any, { optional: true }) as
		| PluginUiDefinition
		| null;

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
		JobProposalModule._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobProposalModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			pageRouteRegistry: this._pageRouteRegistryService
		});

		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'sales-proposals',
				title: 'Proposals',
				icon: 'fas fa-paper-plane',
				link: JOB_PROPOSAL_PAGE_LINK,
				data: {
					translationKey: 'MENU.PROPOSALS',
					permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW],
					featureKey: FeatureEnum.FEATURE_PROPOSAL,
					...(this._store.hasAnyPermission(
						PermissionsEnum.ALL_ORG_EDIT,
						PermissionsEnum.ORG_PROPOSALS_EDIT
					) && {
						add: '/pages/sales/proposals/register'
					})
				}
			},
			'sales',
			'sales-estimates'
		);

		JobProposalModule._hasAppliedRegistrations = true;
	}
}

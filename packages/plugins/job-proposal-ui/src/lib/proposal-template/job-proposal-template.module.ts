import { inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { CKEditorModule } from 'ckeditor4-angular';
import { TranslateModule } from '@ngx-translate/core';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { PermissionsEnum } from '@gauzy/contracts';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService, Store } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	NebularModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { getJobProposalTemplateRoutes, JOB_PROPOSAL_TEMPLATE_PAGE_LINK } from './job-proposal-template.routes';
import { ProposalTemplateListComponent } from './components/proposal-template-list/proposal-template-list.component';
import { ProposalTemplateFormComponent } from './components/proposal-template-form/proposal-template-form.component';

@NgModule({
	declarations: [ProposalTemplateListComponent, ProposalTemplateFormComponent],
	imports: [
		RouterModule.forChild([]),
		NebularModule,
		CKEditorModule,
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		StatusBadgeModule,
		EmployeeMultiSelectModule,
		DialogsModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: getJobProposalTemplateRoutes,
			multi: true
		}
	]
})
export class JobProposalTemplateModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('JobProposalTemplateModule');
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _store = inject(Store);
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
		JobProposalTemplateModule._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes and nav from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobProposalTemplateModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			pageRouteRegistry: this._pageRouteRegistryService
		});

		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-proposal-template',
				title: 'Proposal Template',
				icon: 'far fa-file-alt',
				link: JOB_PROPOSAL_TEMPLATE_PAGE_LINK,
				data: {
					translationKey: 'MENU.PROPOSAL_TEMPLATE',
					permissionKeys: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
					...(this._store.hasAnyPermission(
						PermissionsEnum.ALL_ORG_EDIT,
						PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT
					) && {
						add: '/pages/jobs/proposal-template?openAddDialog=true'
					})
				}
			},
			'jobs'
		);

		JobProposalTemplateModule._hasAppliedRegistrations = true;
	}
}

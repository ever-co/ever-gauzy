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
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	NebularModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { getJobProposalTemplateRoutes } from './job-proposal-template.routes';
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
		JobProposalTemplateModule._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes and nav from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobProposalTemplateModule._hasAppliedRegistrations) return;

		const def = inject(PLUGIN_DEFINITION);
		applyDeclarativeRegistrations(def, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		JobProposalTemplateModule._hasAppliedRegistrations = true;
	}
}

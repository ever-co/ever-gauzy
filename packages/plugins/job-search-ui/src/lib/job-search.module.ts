import { CurrencyPipe } from '@angular/common';
import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { FileUploadModule } from 'ng2-file-upload';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	DateTimeFormatPipe,
	JobBudgetPipe,
	Nl2BrPipe,
	SmartDataViewLayoutModule,
	DialogsModule,
	NebularModule,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { getJobSearchRoutes } from './job-search.routes';
import { JobSearchComponent } from './components/job-search/job-search.component';
import { JobTitleDescriptionDetailsComponent } from './components/job-title-description-details/job-title-description-details.component';
import { JobStatusComponent } from './components/job-status/job-status.component';
import { ApplyJobManuallyComponent } from './components/apply-job-manually/apply-job-manually.component';

@NgModule({
	declarations: [JobSearchComponent, ApplyJobManuallyComponent],
	imports: [
		RouterModule.forChild([]),
		DateTimeFormatPipe,
		JobBudgetPipe,
		Nl2BrPipe,
		NebularModule,
		CKEditorModule,
		FileUploadModule,
		MomentModule,
		TranslateModule.forChild(),
		SmartDataViewLayoutModule,
		DialogsModule,
		ProposalTemplateSelectModule,
		SelectorsModule,
		SharedModule,
		StatusBadgeModule,
		JobTitleDescriptionDetailsComponent,
		JobStatusComponent
	],
	exports: [RouterModule, JobSearchComponent, ApplyJobManuallyComponent, JobTitleDescriptionDetailsComponent, JobStatusComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: getJobSearchRoutes,
			multi: true
		},
		CurrencyPipe,
	]
})
export class JobSearchModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('JobSearchModule');
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
		JobSearchModule._hasAppliedRegistrations = false;
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes and nav from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobSearchModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		JobSearchModule._hasAppliedRegistrations = true;
	}
}

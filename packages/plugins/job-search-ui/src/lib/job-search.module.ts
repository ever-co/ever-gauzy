import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { MomentModule } from 'ngx-moment';
import { FileUploadModule } from 'ng2-file-upload';
import { Subject, of } from 'rxjs';
import { catchError, map, takeUntil, tap } from 'rxjs/operators';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PluginUiDefinition,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	IntegrationEntitySettingServiceStoreService,
	LoggerService,
	NavMenuBuilderService,
	PageRouteRegistryService
} from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	NebularModule,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { getJobSearchRoutes, JOB_SEARCH_PAGE_LINK } from './job-search.routes';
import { JobSearchComponent } from './components/job-search/job-search.component';
import { COMPONENTS } from './components';

@NgModule({
	declarations: [JobSearchComponent, ...COMPONENTS],
	imports: [
		RouterModule.forChild([]),
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
		StatusBadgeModule
	],
	exports: [RouterModule, ...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: getJobSearchRoutes,
			multi: true
		}
	]
})
export class JobSearchModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('JobSearchModule');
	private readonly _integrationEntitySettingServiceStoreService = inject(IntegrationEntitySettingServiceStoreService);
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION as unknown as any, { optional: true }) as
		| PluginUiDefinition
		| null;
	private readonly _destroy$ = new Subject<void>();

	constructor() {}

	// ─── Plugin Lifecycle ─────────────────────────────────────────

	/** Called by PluginUiModule after the plugin module is instantiated. */
	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
		this._applyDeclarativeRegistrations();
		this._subscribeToJobMatchingEntity();
	}

	/** Called by PluginUiModule when the application is shutting down. */
	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
		JobSearchModule._hasAppliedRegistrations = false;

		// Unsubscribe from all subscriptions
		this._destroy$.next();
		this._destroy$.complete();
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

	// ─── Job Matching Entity Subscription ─────────────────────────

	/**
	 * Subscribes to the job matching entity observable and dynamically
	 * adds or removes the "Browse" nav menu item based on whether
	 * job matching sync is active.
	 */
	private _subscribeToJobMatchingEntity(): void {
		this._integrationEntitySettingServiceStoreService.jobMatchingEntity$
				.pipe(
					catchError((error) => {
						this._log.error('Error in job matching entity subscription', error);
						return of({ currentValue: { sync: false, isActive: false } });
					}),
					map(({ currentValue }) => !!currentValue?.sync && !!currentValue?.isActive),
					distinctUntilChange(),
					takeUntil(this._destroy$),
					tap((isActive: boolean) => (isActive ? this._addNavMenuItem() : this._removeNavMenuItem()))
				)
				.subscribe()
	}

	/**
	 * Adds the "Browse" nav menu item under the jobs section.
	 */
	private _addNavMenuItem(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-browse', // Unique identifier for the menu item
				title: 'Browse', // The title of the menu item
				icon: 'fas fa-list', // The icon class for the menu item, using FontAwesome in this case
				link: JOB_SEARCH_PAGE_LINK, // The link where the menu item directs
				data: {
					translationKey: 'MENU.JOBS_SEARCH', // The translation key for the menu item title
					permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH] // The permission keys required to access the menu item
				}
			},
			'jobs',
			'jobs-proposal-template'
		);
	}

	/**
	 * Removes the "Browse" nav menu item from the jobs section.
	 */
	private _removeNavMenuItem(): void {
		this._navMenuBuilderService.removeNavMenuItem('jobs-browse', 'jobs');
	}
}

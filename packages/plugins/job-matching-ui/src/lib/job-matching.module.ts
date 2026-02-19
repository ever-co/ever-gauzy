import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { catchError, map, takeUntil, tap } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import {
	IntegrationEntitySettingServiceStoreService,
	LoggerService,
	NavMenuBuilderService,
	PageRouteRegistryService
} from '@gauzy/ui-core/core';
import { DialogsModule, NebularModule, SharedModule } from '@gauzy/ui-core/shared';
import { getJobMatchingRoutes, JOB_MATCHING_PAGE_LINK } from './job-matching.routes';
import { JobMatchingComponent } from './components/job-matching/job-matching.component';

@NgModule({
	declarations: [JobMatchingComponent],
	imports: [
		RouterModule.forChild([]),
		NebularModule,
		TranslateModule.forChild(),
		NgSelectModule,
		SharedModule,
		DialogsModule
	],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: getJobMatchingRoutes,
			multi: true
		}
	]
})
export class JobMatchingModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static _hasAppliedRegistrations = false;

	private readonly _log = inject(LoggerService).withContext('JobMatchingModule');
	private readonly _integrationEntitySettingServiceStoreService = inject(IntegrationEntitySettingServiceStoreService);
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);
	private readonly _pluginDefinition = inject(PLUGIN_DEFINITION, { optional: true });
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
		JobMatchingModule._hasAppliedRegistrations = false;

		// Unsubscribe from all subscriptions
		this._destroy$.next();
		this._destroy$.complete();
	}

	// ─── Registration ─────────────────────────────────────────────

	/** Applies routes and nav from the plugin definition. Guarded to run once per app lifecycle. */
	private _applyDeclarativeRegistrations(): void {
		if (JobMatchingModule._hasAppliedRegistrations || !this._pluginDefinition) return;

		applyDeclarativeRegistrations(this._pluginDefinition, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		JobMatchingModule._hasAppliedRegistrations = true;
	}

	// ─── Job Matching Entity Subscription ─────────────────────────

	/**
	 * Subscribes to the job matching entity observable and dynamically
	 * adds or removes the "Matching" nav menu item based on whether
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
	 * Adds the "Matching" nav menu item under the jobs section.
	 */
	private _addNavMenuItem(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'jobs-matching', // Unique identifier for the menu item
				title: 'Matching', // The title of the menu item
				icon: 'fas fa-user', // The icon class for the menu item, using FontAwesome in this case
				link: JOB_MATCHING_PAGE_LINK, // The link where the menu item directs
				data: {
					translationKey: 'MENU.JOBS_MATCHING', // The translation key for the menu item title
					permissionKeys: [PermissionsEnum.ORG_JOB_MATCHING_VIEW] // The permission keys required to access the menu item
				}
			},
			'jobs',
			'jobs-proposal-template'
		);
	}

	/**
	 * Removes the "Matching" nav menu item from the jobs section.
	 */
	private _removeNavMenuItem(): void {
		this._navMenuBuilderService.removeNavMenuItem('jobs-matching', 'jobs');
	}
}

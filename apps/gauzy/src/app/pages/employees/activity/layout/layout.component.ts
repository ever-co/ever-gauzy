import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, QueryParamsHandling } from '@angular/router';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageTabRegistryService, PageTabsetRegistryId, RouteUtil } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-activities-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss'],
	providers: [RouteUtil]
})
export class ActivityLayoutComponent implements OnInit, OnDestroy {
	public title: string;
	public tabsetId: PageTabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _routeUtil: RouteUtil,
		private readonly _pageTabRegistryService: PageTabRegistryService
	) {}

	ngOnInit(): void {
		// Register the page tabs
		this.registerPageTabs();

		this._routeUtil.data$
			.pipe(
				tap((data) => (this.title = data.title)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._cdr.detectChanges();
	}

	/**
	 * Registers page tabs for the timesheet module.
	 * Ensures that tabs are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageTabs(): void {
		// Register the time-activity tab
		this._pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'time-activities', // The identifier for the tab
			tabsetType: 'route', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('ACTIVITY.TIME_AND_ACTIVITIES'), // The title for the tab
			responsive: true, // Whether the tab is responsive
			route: '/pages/employees/activity/time-activities', // The route for the tab
			queryParamsHandling: 'merge' as QueryParamsHandling,
			activeLinkOptions: { exact: false }, // The options for the active link
			order: 1, // The order of the tab
			permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIME_TRACKING_DASHBOARD] // The permissions required to display the tab
		});

		// Register the screenshots tab
		this._pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'screenshots', // The identifier for the tab
			tabsetType: 'route', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('ACTIVITY.SCREENSHOTS'), // The title for the tab
			responsive: true, // Whether the tab is responsive
			route: '/pages/employees/activity/screenshots', // The route for the tab
			queryParamsHandling: 'merge' as QueryParamsHandling,
			activeLinkOptions: { exact: false }, // The options for the active link
			order: 2, // The order of the tab
			permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIME_TRACKING_DASHBOARD] // The permissions required to display the tab
		});

		// Register the app activity tab
		this._pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'app-activity', // The identifier for the tab
			tabsetType: 'route', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('ACTIVITY.APPS'), // The title for the tab
			responsive: true, // Whether the tab is responsive
			route: '/pages/employees/activity/apps', // The route for the tab
			queryParamsHandling: 'merge' as QueryParamsHandling,
			activeLinkOptions: { exact: false }, // The options for the active link
			order: 3, // The order of the tab
			permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIME_TRACKING_DASHBOARD] // The permissions required to display the tab
		});

		// Register the visited sites tab
		this._pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'urls-activity', // The identifier for the tab
			tabsetType: 'route', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('ACTIVITY.VISITED_SITES'), // The title for the tab
			responsive: true, // Whether the tab is responsive
			route: '/pages/employees/activity/urls', // The route for the tab
			queryParamsHandling: 'merge' as QueryParamsHandling,
			activeLinkOptions: { exact: false }, // The options for the active link
			order: 4, // The order of the tab
			permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIME_TRACKING_DASHBOARD] // The permissions required to display the tab
		});
	}

	ngOnDestroy(): void {}
}

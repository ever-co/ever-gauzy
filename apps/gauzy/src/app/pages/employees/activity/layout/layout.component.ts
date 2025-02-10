import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, QueryParamsHandling } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IDateRangePicker, PermissionsEnum } from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	PageTabRegistryService,
	PageTabsetRegistryId,
	RouteUtil
} from '@gauzy/ui-core/core';
import { VideoService } from '@gauzy/plugin-videos-ui';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-time-activities-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    providers: [RouteUtil],
    standalone: false
})
export class ActivityLayoutComponent implements OnInit, OnDestroy {
	public title: string;
	public tabsetId: PageTabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset
	public selectedDateRange$: Observable<IDateRangePicker> = this._dateRangePickerBuilderService.selectedDateRange$;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _routeUtil: RouteUtil,
		private readonly _pageTabRegistryService: PageTabRegistryService,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly _videoService: VideoService
	) {}

	ngOnInit(): void {
		// Register the page tabs
		this.registerPageTabs();
		// Subscribe to video availability
		this._videoService.isAvailable$
			.pipe(
				tap((isAvailable) => {
					const tabId = 'videos';
					if (!isAvailable) {
						this._pageTabRegistryService.removePageTab(this.tabsetId, tabId);
						return;
					}
					this._pageTabRegistryService.addPageTab(
						{
							tabsetId: this.tabsetId, // The identifier for the tabset
							tabId, // The identifier for the tab
							tabsetType: 'route', // The type of tabset to use
							tabTitle: (_i18n) => _i18n.getTranslation('Videos'), // The title for the tab
							responsive: true, // Whether the tab is responsive
							route: '/pages/employees/activity/videos', // The route for the tab
							queryParamsHandling: 'merge' as QueryParamsHandling,
							activeLinkOptions: { exact: false }, // The options for the active link
							order: 3, // The order of the tab
							permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIME_TRACKING_DASHBOARD] // The permissions required to display the tab
						},
						this.tabsetId
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();

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
			order: 4, // The order of the tab
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
			order: 5, // The order of the tab
			permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIME_TRACKING_DASHBOARD] // The permissions required to display the tab
		});
	}

	ngOnDestroy(): void {}
}

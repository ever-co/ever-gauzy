import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageTabRegistryService, Store, PageTabsetRegistryId } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	selector: 'ngx-timesheet-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class TimesheetLayoutComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public tabsetId: PageTabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		private readonly _pageTabRegistryService: PageTabRegistryService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Register the page tabs
		this.registerPageTabs();
	}

	/**
	 * Registers page tabs for the timesheet module.
	 * Ensures that tabs are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageTabs(): void {
		// Define the permissions required to view daily, weekly, or calendar timesheets
		const permissions = [
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_TRACKING_DASHBOARD
		];

		// Check if the user has permission to view daily, weekly, or calendar timesheets
		if (this._store.hasAnyPermission(...permissions)) {
			// Register the daily timesheet tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'timesheet', // The identifier for the tabset
				tabId: 'daily', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: '/pages/employees/timesheets/daily', // The route for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.DAILY'), // The title for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 1 // The order of the tab
			});

			// Register the weekly timesheet tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'timesheet', // The identifier for the tabset
				tabId: 'weekly', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: '/pages/employees/timesheets/weekly', // The route for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.WEEKLY'), // The title for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 2 // The order of the tab
			});

			// Register the calendar timesheet tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'timesheet', // The identifier for the tabset
				tabId: 'calendar', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: '/pages/employees/timesheets/calendar', // The route for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.CALENDAR'), // The title for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 3 // The order of the tab
			});
		}

		// Check if the user has permission to approve timesheets
		if (this._store.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET)) {
			// Register the approvals tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'timesheet', // The identifier for the tabset
				tabId: 'approvals', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: '/pages/employees/timesheets/approvals', // The route for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.APPROVALS'), // The title for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 4 // The order of the tab
			});
		}
	}

	ngOnDestroy(): void {
		// Delete the timesheet tabset from the registry
		this._pageTabRegistryService.deleteTabset('timesheet');
	}
}

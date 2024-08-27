import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageTabRegistryService, Store, TabsetRegistryId } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	selector: 'ngx-timesheet-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class TimesheetLayoutComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public tabsetId: TabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset

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
				// The identifier for the tabset
				tabsetId: 'timesheet',
				// The identifier for the tab
				tabId: 'daily',
				// The type of tabset to use
				tabsetType: 'route',
				// Whether the tab is responsive
				responsive: true,
				// The route for the tab
				route: '/pages/employees/timesheets/daily',
				// The title for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.DAILY'),
				//	The options for the active link
				activeLinkOptions: { exact: false },
				// The order of the tab
				order: 1
			});

			// Register the weekly timesheet tab
			this._pageTabRegistryService.registerPageTab({
				// The identifier for the tabset
				tabsetId: 'timesheet',
				// The identifier for the tab
				tabId: 'weekly',
				// The type of tabset to use
				tabsetType: 'route',
				// Whether the tab is responsive
				responsive: true,
				// The route for the tab
				route: '/pages/employees/timesheets/weekly',
				// The title for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.WEEKLY'),
				//	The options for the active link
				activeLinkOptions: { exact: false },
				// The order of the tab
				order: 2
			});

			// Register the calendar timesheet tab
			this._pageTabRegistryService.registerPageTab({
				// The identifier for the tabset
				tabsetId: 'timesheet',
				// The identifier for the tab
				tabId: 'calendar',
				// The type of tabset to use
				tabsetType: 'route',
				// Whether the tab is responsive
				responsive: true,
				// The route for the tab
				route: '/pages/employees/timesheets/calendar',
				// The title for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.CALENDAR'),
				//	The options for the active link
				activeLinkOptions: { exact: false },
				// The order of the tab
				order: 3
			});
		}

		// Check if the user has permission to approve timesheets
		if (this._store.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET)) {
			// Register the approvals tab
			this._pageTabRegistryService.registerPageTab({
				// The identifier for the tabset
				tabsetId: 'timesheet',
				// The identifier for the tab
				tabId: 'approvals',
				// The type of tabset to use
				tabsetType: 'route',
				// Whether the tab is responsive
				responsive: true,
				// The route for the tab
				route: '/pages/employees/timesheets/approvals',
				// The title for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.APPROVALS'),
				//	The options for the active link
				activeLinkOptions: { exact: false },
				// The order of the tab
				order: 4
			});
		}
	}

	ngOnDestroy(): void {
		// Clear the registry
		this._pageTabRegistryService.clear();
	}
}

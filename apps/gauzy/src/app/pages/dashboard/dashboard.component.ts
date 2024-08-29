import { AfterContentChecked, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ISelectedEmployee, PermissionsEnum } from '@gauzy/contracts';
import { PageTabRegistryService, Store, PageTabsetRegistryId } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DynamicTabsComponent } from '@gauzy/ui-core/shared';

@UntilDestroy()
@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent extends TranslationBaseComponent implements AfterContentChecked, OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public tabsetId: PageTabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset
	public selectedEmployee: ISelectedEmployee;

	@ViewChild('dynamicTabs') dynamicTabsComponent!: DynamicTabsComponent;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _cdr: ChangeDetectorRef,
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

	ngAfterViewInit(): void {
		this._store.selectedEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee),
				tap((employee: ISelectedEmployee) => (this.selectedEmployee = employee)),
				tap(() => this.registerAccountingTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterContentChecked(): void {
		this._cdr.detectChanges();
	}

	/**
	 * Returns the full route path for the specified route name within the dashboard page.
	 *
	 * @param path The name of the route (e.g., 'settings', 'profile').
	 * @returns The full route path (e.g., '/pages/dashboard/settings').
	 */
	getRoute(path: string): string {
		return `/pages/dashboard/${path}`;
	}

	/**
	 * Registers page tabs for the dashboard module.
	 * Ensures that tabs are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageTabs(): void {
		// Check if the user has permission to view teams
		if (this._store.hasAnyPermission(PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TEAM_DASHBOARD)) {
			// Register the teams tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'dashboard', // The identifier for the tabset
				tabId: 'teams', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: this.getRoute('teams'), // The route for the tab
				tabTitle: () => this.getTranslation('ORGANIZATIONS_PAGE.TEAMS'), // The title for the tab
				tabIcon: 'people-outline', // The icon for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 1 // The order of the tab
			});
		}

		// Check if the user has permission to view project management
		if (
			this._store.hasAnyPermission(
				PermissionsEnum.ADMIN_DASHBOARD_VIEW,
				PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD
			)
		) {
			// Register the project management tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'dashboard', // The identifier for the tabset
				tabId: 'project-management', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: this.getRoute('project-management'), // The route for the tab
				tabTitle: () => this.getTranslation('DASHBOARD_PAGE.PROJECT_MANAGEMENT'), // The title for the tab
				tabIcon: 'browser-outline', // The icon for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 2 // The order of the tab
			});
		}

		// Check if the user has permission to view time tracking
		if (
			this._store.hasAnyPermission(PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKING_DASHBOARD)
		) {
			// Register the time tracking tab
			this._pageTabRegistryService.registerPageTab({
				tabsetId: 'dashboard', // The identifier for the tabset
				tabId: 'time-tracking', // The identifier for the tab
				tabsetType: 'route', // The type of tabset to use
				route: this.getRoute('time-tracking'), // The route for the tab
				tabTitle: () => this.getTranslation('TIMESHEET.TIME_TRACKING'), // The title for the tab
				tabIcon: 'clock-outline', // The icon for the tab
				responsive: true, // Whether the tab is responsive
				activeLinkOptions: { exact: false }, // The options for the active link
				order: 3 // The order of the tab
			});
		}
	}

	/**
	 * Registers accounting tabs for the dashboard module.
	 * Ensures that tabs are registered only once.
	 */
	registerAccountingTabs(): void {
		// Remove the specified page tabs for the current tenant
		this._pageTabRegistryService.removePageTab('dashboard', 'accounting');
		this._pageTabRegistryService.removePageTab('dashboard', 'hr');

		// Check if the user has permission to view accounting
		if (this._store.hasAnyPermission(PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.ACCOUNTING_DASHBOARD)) {
			if (!this.selectedEmployee || !this.selectedEmployee.id) {
				// Register the accounting tab
				this._pageTabRegistryService.registerPageTab({
					tabsetId: 'dashboard', // The identifier for the tabset
					tabId: 'accounting', // The identifier for the tab
					tabsetType: 'route', // The type of tabset to use
					route: this.getRoute('accounting'), // The route for the tab
					tabTitle: () => this.getTranslation('DASHBOARD_PAGE.ACCOUNTING'), // The title for the tab
					tabIcon: 'credit-card-outline', // The icon for the tab
					responsive: true, // Whether the tab is responsive
					activeLinkOptions: { exact: false }, // The options for the active link
					order: 4 // The order of the tab
				});
			}
		}

		// Check if the user has permission to view human resources
		if (
			this._store.hasAllPermissions(
				PermissionsEnum.ADMIN_DASHBOARD_VIEW,
				PermissionsEnum.HUMAN_RESOURCE_DASHBOARD
			)
		) {
			if (this.selectedEmployee && this.selectedEmployee.id) {
				// Register the human resources tab
				this._pageTabRegistryService.registerPageTab({
					tabsetId: 'dashboard', // The identifier for the tabset
					tabId: 'hr', // The identifier for the tab
					tabsetType: 'route', // The type of tabset to use
					route: this.getRoute('hr'), // The route for the tab
					tabTitle: () => this.getTranslation('DASHBOARD_PAGE.HUMAN_RESOURCES'), // The title for the tab
					tabIcon: 'person-outline', // The icon for the tab
					responsive: true, // Whether the tab is responsive
					activeLinkOptions: { exact: false }, // The options for the active link
					order: 5 // The order of the tab
				});
			}
		}

		// Reload the dynamic tabs component
		this.dynamicTabsComponent.reload$.next(true);
	}

	/**
	 * Clears the registry when the component is destroyed.
	 */
	ngOnDestroy() {
		// Delete the dashboard tabset from the registry
		this._pageTabRegistryService.deleteTabset('dashboard');
	}
}

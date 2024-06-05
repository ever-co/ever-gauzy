import { AfterContentChecked, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from '@gauzy/ui-sdk/common';
import { ISelectedEmployee, PermissionsEnum } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent extends TranslationBaseComponent implements AfterContentChecked, OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public loading = true;
	public selectedEmployee: ISelectedEmployee;

	constructor(
		private readonly cdr: ChangeDetectorRef,
		private readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnTabs();
		this.store.selectedEmployee$
			.pipe(
				tap((employee: ISelectedEmployee) => (this.selectedEmployee = employee)),
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterContentChecked(): void {
		this.cdr.detectChanges();
	}

	/**
	 * Returns the route path for the specified route name within the dashboard page.
	 * @param name The name of the route.
	 * @returns The route path.
	 */
	getRoute(name: string): string {
		return `/pages/dashboard/${name}`;
	}

	/**
	 * Populates the tabs array based on user permissions and selected employee.
	 */
	loadTabs(): void {
		this.tabs = [
			...(this.store.hasAllPermissions(PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TEAM_DASHBOARD)
				? [
						{
							title: this.getTranslation('ORGANIZATIONS_PAGE.TEAMS'),
							icon: 'people-outline',
							responsive: true,
							route: this.getRoute('teams'),
							activeLinkOptions: { exact: false }
						} as NbRouteTab
				  ]
				: []),
			...(this.store.hasAllPermissions(
				PermissionsEnum.ADMIN_DASHBOARD_VIEW,
				PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD
			)
				? [
						{
							title: this.getTranslation('DASHBOARD_PAGE.PROJECT_MANAGEMENT'),
							icon: 'browser-outline',
							responsive: true,
							route: this.getRoute('project-management'),
							activeLinkOptions: { exact: false }
						} as NbRouteTab
				  ]
				: []),
			...(this.store.hasAllPermissions(
				PermissionsEnum.ADMIN_DASHBOARD_VIEW,
				PermissionsEnum.TIME_TRACKING_DASHBOARD
			)
				? [
						{
							title: this.getTranslation('DASHBOARD_PAGE.TIME_TRACKING'),
							icon: 'clock-outline',
							responsive: true,
							route: this.getRoute('time-tracking'),
							activeLinkOptions: { exact: false }
						} as NbRouteTab
				  ]
				: []),
			...(this.store.hasAllPermissions(PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.ACCOUNTING_DASHBOARD)
				? [
						...(!this.selectedEmployee || !this.selectedEmployee.id
							? [
									{
										title: this.getTranslation('DASHBOARD_PAGE.ACCOUNTING'),
										icon: 'credit-card-outline',
										responsive: true,
										route: this.getRoute('accounting'),
										activeLinkOptions: { exact: false }
									} as NbRouteTab
							  ]
							: [])
				  ]
				: []),
			...(this.store.hasAllPermissions(
				PermissionsEnum.ADMIN_DASHBOARD_VIEW,
				PermissionsEnum.HUMAN_RESOURCE_DASHBOARD
			)
				? [
						...(this.selectedEmployee && this.selectedEmployee.id
							? [
									{
										title: this.getTranslation('DASHBOARD_PAGE.HUMAN_RESOURCES'),
										icon: 'person-outline',
										responsive: true,
										route: this.getRoute('hr'),
										activeLinkOptions: { exact: false }
									} as NbRouteTab
							  ]
							: [])
				  ]
				: [])
		];
		this.loading = false;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}

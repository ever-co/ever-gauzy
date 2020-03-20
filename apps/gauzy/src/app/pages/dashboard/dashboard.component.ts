import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

enum DASHBOARD_TYPES {
	LOADING = 'LOADING',
	ORGANIZATION_EMPLOYEES = 'ORGANIZATION_EMPLOYEES',
	EMPLOYEE_STATISTICS = 'EMPLOYEE_STATISTICS',
	DATA_ENTRY_SHORTCUTS = 'DATA_ENTRY_SHORTCUTS'
}

@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	tabs: {
		title: string;
		icon: string;
		responsive: boolean;
		route: string;
	}[] = [];

	loading = true;

	constructor(
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.store.selectedEmployee$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((emp) => {
						this.loadTabs(emp);
					});
			});
	}

	getRoute(name: string) {
		return `/pages/dashboard/${name}`;
	}

	loadTabs(selectedEmployee: SelectedEmployee) {
		let conditionalTabs = [];

		if (selectedEmployee && selectedEmployee.id) {
			conditionalTabs = [
				{
					title: this.getTranslation(
						'DASHBOARD_PAGE.HUMAN_RESOURCES'
					),
					icon: 'person-outline',
					responsive: true,
					route: this.getRoute('hr')
				}
			];
		} else {
			conditionalTabs = [
				{
					title: this.getTranslation('DASHBOARD_PAGE.ACCOUNTING'),
					icon: 'credit-card-outline',
					responsive: true,
					route: this.getRoute('accounting')
				}
			];
		}

		this.tabs = [
			...conditionalTabs,
			{
				title: this.getTranslation('DASHBOARD_PAGE.TIME_TRACKING'),
				icon: 'clock-outline',
				responsive: true,
				route: this.getRoute('time-tracking')
			},
			{
				title: this.getTranslation('DASHBOARD_PAGE.PROJECT_MANAGEMENT'),
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('project-management')
			}
		];

		this.loading = false;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

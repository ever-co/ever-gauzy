import { Component, OnDestroy, OnInit } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	tabs: {
		title: string;
		icon: string;
		responsive: boolean;
		route: string;
	}[] = [];

	loading = true;
	selectedEmployee;

	constructor(
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslation();
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.store.selectedEmployee$
					.pipe(untilDestroyed(this))
					.subscribe((emp) => {
						this.selectedEmployee = emp;
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

	_applyTranslation() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadTabs(this.selectedEmployee);
			});
	}

	ngOnDestroy() {}
}

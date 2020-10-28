import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { IAggregatedEmployeeStatistic, IOrganization } from '@gauzy/models';
import {
	SelectedEmployee,
	ALL_EMPLOYEES_SELECTED
} from '../../../@theme/components/header/selectors/employee/employee.component';
import { Router } from '@angular/router';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-accounting',
	templateUrl: './accounting.component.html',
	styleUrls: [
		'../../organizations/edit-organization/edit-organization.component.scss',
		'./accounting.component.scss'
	]
})
export class AccountingComponent implements OnInit, OnDestroy {
	aggregatedEmployeeStatistics: IAggregatedEmployeeStatistic;
	selectedDate: Date;
	selectedOrganization: IOrganization;
	selectedEmployee: SelectedEmployee;
	isEmployee: boolean;

	constructor(
		private store: Store,
		private readonly router: Router,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.isEmployee = user.employee ? true : false)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				this.selectedEmployee = employee;
				if (employee && employee.id) {
					this.navigateToEmployeeStatistics();
				}
			});
		this.store.selectedDate$
			.pipe(
				filter((date) => !!date),
				untilDestroyed(this)
			)
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedOrganization && !this.isEmployee) {
					this.loadData(this.selectedOrganization);
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this.selectedOrganization = organization;
				if (!this.isEmployee) {
					this.loadData(organization);
				}
			});
	}

	navigateToEmployeeStatistics() {
		this.router.navigate(['/pages/dashboard/hr']);
	}

	loadData = async (organization) => {
		if (organization) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = organization;
			this.aggregatedEmployeeStatistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
				{
					organizationId,
					tenantId,
					filterDate:
						this.selectedDate || this.store.selectedDate || null
				}
			);
		}
	};

	selectEmployee(
		employee: SelectedEmployee,
		firstName: string,
		lastName: string,
		imageUrl: string
	) {
		this.store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
		this.store.selectedEmployee.firstName = firstName;
		this.store.selectedEmployee.lastName = lastName;
		this.store.selectedEmployee.imageUrl = imageUrl;
		this.navigateToEmployeeStatistics();
	}

	ngOnDestroy(): void {}
}

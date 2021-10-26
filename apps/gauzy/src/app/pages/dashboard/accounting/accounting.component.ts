import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import {
	IAggregatedEmployeeStatistic,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
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
	selectedEmployee: ISelectedEmployee;
	isEmployee: boolean;

	constructor(
		private readonly employeesService: EmployeesService,
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

	async selectEmployee(employee: ISelectedEmployee) {
		const people  = await this.employeesService.getEmployeeById(
			employee.id,
			['user']
		);
		this.store.selectedEmployee = (employee.id) ? {
			id: people.id,
			firstName: people.user.firstName,
			lastName: people.user.lastName,
			imageUrl: people.user.imageUrl,
			employeeLevel: people.employeeLevel,
			shortDescription: people.short_description
		} as ISelectedEmployee : ALL_EMPLOYEES_SELECTED;
	}

	ngOnDestroy(): void {}
}

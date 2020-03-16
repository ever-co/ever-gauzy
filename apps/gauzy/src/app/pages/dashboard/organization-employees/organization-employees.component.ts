import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.serivce';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AggregatedEmployeeStatistic, Organization } from '@gauzy/models';
import {
	SelectedEmployee,
	ALL_EMPLOYEES_SELECTED
} from '../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ga-organization-employees',
	templateUrl: './organization-employees.component.html',
	styleUrls: [
		'../../organizations/edit-organization/edit-organization.component.scss',
		'./organization-employees.component.scss'
	]
})
export class OrganizationEmployeesComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	aggregatedEmployeeStatistics: AggregatedEmployeeStatistic;
	selectedDate: Date;
	selectedOrganization: Organization;
	selectedEmployee: SelectedEmployee;

	constructor(
		private store: Store,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				this.selectedOrganization = organization;
				this.loadData(organization);
			});

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedOrganization) {
					this.loadData(this.selectedOrganization);
				}
			});
	}

	loadData = async (organization) => {
		if (organization) {
			this.aggregatedEmployeeStatistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
				{
					organizationId: organization.id,
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
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

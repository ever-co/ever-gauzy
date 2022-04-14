import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, debounceTime } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import {
	IAggregatedEmployeeStatistic,
	IDateRangePicker,
	IOrganization,
	ISelectedEmployee,
	IUser
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import {
	EmployeesService,
	EmployeeStatisticsService,
	Store,
	ToastrService
} from '../../../@core/services';

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
	selectedDateRange: IDateRangePicker;
	organization: IOrganization;
	isEmployee: boolean;

	statistics$: Subject<any> = new Subject();

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly toastrService: ToastrService
	) {}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (
					this.isEmployee = user.employee ? true : false
				)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee && !!employee.id),
				tap(() => this.navigateToEmployeeStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		this.statistics$
			.pipe(
				debounceTime(300),
				tap(() => this.getAggregateStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
				}),
				tap(() => this.statistics$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	navigateToEmployeeStatistics() {
		this.router.navigate(['/pages/dashboard/hr']);
	}

	async getAggregateStatistics() {
		if (!this.organization || this.isEmployee) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { startDate, endDate } = this.selectedDateRange;

			this.aggregatedEmployeeStatistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
				{
					organizationId,
					tenantId,
					startDate,
					endDate
				}
			);
		} catch (error) {
			console.log('Error while retriving employee aggregate statistics', error);
			this.toastrService.danger(error);
		}
	}

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

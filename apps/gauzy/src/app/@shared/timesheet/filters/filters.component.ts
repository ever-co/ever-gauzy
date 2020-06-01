// tslint:disable: no-input-rename
import {
	Component,
	OnInit,
	Input,
	Output,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import {
	TimeLogFilters,
	TimeLogType,
	TimeLogSourceEnum,
	Organization,
	PermissionsEnum
} from '@gauzy/models';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Store } from '../../../@core/services/store.service';
import { EmployeesService } from '../../../@core/services/employees.service';

@Component({
	selector: 'ngx-filters',
	templateUrl: './filters.component.html',
	styleUrls: ['./filters.component.scss']
})
export class FiltersComponent implements OnInit, OnDestroy {
	today: Date = new Date();
	canChangeSelectedEmployee = false;
	TimeLogType = TimeLogType;
	TimeLogSourceEnum = TimeLogSourceEnum;
	updateLogs$: Subject<any> = new Subject();

	@Input() dateRange: 'day' | 'week' | 'month' = 'day';
	@Input() filters: TimeLogFilters = {};
	@Output() filtersChange: EventEmitter<TimeLogFilters> = new EventEmitter();

	@Input() hasDateRangeFilter = true;
	@Input() hasEmployeeFilter = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;

	private date: Date;
	organization: Organization;
	employees: any;
	public get selectedDate(): Date {
		return this.date;
	}
	public set selectedDate(value: Date) {
		this.date = value;
		this.filters.startDate = moment(value).startOf(this.dateRange).toDate();
		this.filters.endDate = moment(value).endOf(this.dateRange).toDate();

		this.updateLogs$.next();
	}

	constructor(
		private store: Store,
		private employeesService: EmployeesService
	) {}

	ngOnInit() {
		// if (this.activatedRoute.snapshot.queryParams) {
		// 	const query = this.activatedRoute.snapshot.queryParams;
		// 	if (query.startDate) {
		// 		this.filters.startDate = toLocal(query.startDate).toDate();
		// 		this.selectedDate = this.filters.startDate;
		// 	}

		// 	if (query.endDate) {
		// 		this.filters.endDate = toLocal(query.endDate).toDate();
		// 	}

		// 	if (query.organizationId) {
		// 		this.filters.organizationId = query.organizationId;
		// 	}

		// 	if (query.employeeId) {
		// 		this.filters.employeeId = query.employeeId;
		// 	}
		// }

		this.selectedDate = this.today;
		this.updateLogs$.pipe(untilDestroyed(this)).subscribe(() => {
			Object.keys(this.filters).forEach((key) =>
				this.filters[key] === undefined ? delete this.filters[key] : {}
			);
			this.filtersChange.emit(this.filters);
		});

		this.store.user$.pipe(untilDestroyed(this)).subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				if (organization) {
					this.organization = organization;
					this.loadEmployees();
				}
			});
	}

	async nextDay() {
		const date = moment(this.selectedDate).add(1, this.dateRange);
		if (date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	async previousDay() {
		this.selectedDate = moment(this.selectedDate)
			.subtract(1, this.dateRange)
			.toDate();
	}

	triggerFilterChange(): void {
		this.updateLogs$.next();
	}

	private async loadEmployees(): Promise<void> {
		const { items = [] } = await this.employeesService.getWorking(
			this.organization.id,
			this.selectedDate,
			true
		);
		this.employees = items;
	}

	ngOnDestroy(): void {}
}

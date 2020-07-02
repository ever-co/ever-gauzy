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
	PermissionsEnum,
	OrganizationPermissionsEnum,
	Employee
} from '@gauzy/models';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Store } from '../../../@core/services/store.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Options, ChangeContext } from 'ng5-slider';
import { NgxPermissionsService } from 'ngx-permissions';

@Component({
	selector: 'ngx-filters',
	templateUrl: './filters.component.html',
	styleUrls: ['./filters.component.scss']
})
export class FiltersComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	TimeLogType = TimeLogType;
	TimeLogSourceEnum = TimeLogSourceEnum;
	updateLogs$: Subject<any> = new Subject();

	@Input() dateRange: 'day' | 'week' | 'month' = 'day';
	private _filters: TimeLogFilters = {
		employeeIds: [],
		source: [],
		logType: []
	};
	futureDateAllowed: boolean;

	@Input()
	public get filters(): TimeLogFilters {
		return this._filters;
	}
	public set filters(value: TimeLogFilters) {
		this._filters = value;
		this.activityLevel = {
			start: value.activityLevel.start || 0,
			end: value.activityLevel.end || 100
		};
	}
	@Output() filtersChange: EventEmitter<TimeLogFilters> = new EventEmitter();

	@Input() hasDateRangeFilter = true;
	@Input() hasEmployeeFilter = true;
	@Input() multipleEmployeSelect = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;

	activityLevel = {
		start: 0,
		end: 100
	};
	sliderOptions: Partial<Options> = {
		floor: 0,
		ceil: 100,
		step: 5
	};
	private date: Date;
	organization: Organization;
	employees: Employee[];
	public get selectedDate(): Date {
		return this.date;
	}
	public set selectedDate(value: Date) {
		this.date = value;
		this.filters.startDate = moment(value).startOf(this.dateRange).toDate();
		this.filters.endDate = moment(value).endOf(this.dateRange).toDate();

		this.updateLogs$.next();
	}

	private _employeeIds: string | string[];
	public get employeeIds(): string | string[] {
		return this._employeeIds;
	}
	public set employeeIds(value: string | string[]) {
		this._employeeIds = value;
		this.filters.employeeIds = value instanceof Array ? value : [value];
		this.triggerFilterChange();
	}

	constructor(
		private store: Store,
		private employeesService: EmployeesService,
		private ngxPermissionsService: NgxPermissionsService
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
			if (this.filters.employeeIds.length === 0) {
				return;
			}
			this.filtersChange.emit(this.filters);
		});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				if (organization) {
					this.organization = organization;
					this.loadEmployees();
				}
			});

		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
			});

		this.updateLogs$.next();
	}

	isNextDisabled() {
		return this.futureDateAllowed
			? false
			: moment(this.selectedDate).isSameOrAfter(moment(), 'day');
	}

	isTodayDisabled() {
		return moment(this.selectedDate).isSame(moment(), 'day');
	}

	nextDay() {
		const date = moment(this.selectedDate).add(1, this.dateRange);
		if (!this.futureDateAllowed && date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	previousDay() {
		this.selectedDate = moment(this.selectedDate)
			.subtract(1, this.dateRange)
			.toDate();
	}

	setActivityLevel($event: ChangeContext): void {
		this.filters.activityLevel = {
			start: $event.value,
			end: $event.highValue
		};
		this.activityLevel = this.filters.activityLevel;
		this.updateLogs$.next();
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

		if (this.employees.length > 0) {
			this.filters.employeeIds = [this.employees[0].id];
			this._employeeIds = this.multipleEmployeSelect
				? [this.employees[0].id]
				: this.employees[0].id;
		}
	}

	ngOnDestroy(): void {}
}

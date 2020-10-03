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
	ITimeLogFilters,
	TimeLogType,
	TimeLogSourceEnum,
	IOrganization,
	PermissionsEnum,
	OrganizationPermissionsEnum,
	IEmployee,
	IUser
} from '@gauzy/models';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Store } from '../../../@core/services/store.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Options, ChangeContext } from 'ng5-slider';
import { NgxPermissionsService } from 'ngx-permissions';
import { TimesheetFilterService } from '../timesheet-filter.service';
import { debounceTime, take } from 'rxjs/operators';
import { isEmpty } from 'libs/utils';

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
	private _filters: ITimeLogFilters = {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: []
	};
	futureDateAllowed: boolean;
	hasFilterApplies: boolean;

	@Input()
	public get filters(): ITimeLogFilters {
		return this._filters;
	}
	public set filters(value: ITimeLogFilters) {
		this._filters = value;
		this.activityLevel = {
			start: value.activityLevel ? value.activityLevel.start : 0,
			end: value.activityLevel ? value.activityLevel.end : 100
		};
	}
	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

	@Input() hasProjectFilter = true;
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
	organization: IOrganization;
	employees: IEmployee[];
	public get selectedDate(): Date {
		return this.filters.date as Date;
	}
	public set selectedDate(value: Date) {
		this.filters.date = value;
		this.filters.startDate = moment(value).startOf(this.dateRange).toDate();
		this.filters.endDate = moment(value).endOf(this.dateRange).toDate();
		this.triggerFilterChange();
	}

	private _employeeIds: string | string[];
	public get employeeIds(): string | string[] {
		return this._employeeIds;
	}
	public set employeeIds(value: string | string[]) {
		if (!isEmpty(value)) {
			this._employeeIds = value;
			this.filters.employeeIds = value instanceof Array ? value : [value];
		} else {
			this.filters.employeeIds = [];
		}
		this.triggerFilterChange();
	}

	constructor(
		private store: Store,
		private timesheetFilterService: TimesheetFilterService,
		private employeesService: EmployeesService,
		private ngxPermissionsService: NgxPermissionsService
	) {}

	ngOnInit() {
		this.selectedDate = this.today;
		this.updateLogs$
			.pipe(untilDestroyed(this))
			.pipe(debounceTime(400))
			.subscribe(() => {
				this.hasFilterApplies = this.hasFilter();
				Object.keys(this.filters).forEach((key) =>
					this.filters[key] === undefined
						? delete this.filters[key]
						: {}
				);
				if (this.filters.employeeIds.length === 0) {
					return;
				}
				this.filtersChange.emit(this.filters);
			});

		this.timesheetFilterService.filter$
			.pipe(untilDestroyed(this), take(1))
			.subscribe((filters: ITimeLogFilters) => {
				this.filters = Object.assign({}, filters);
				this.selectedDate = new Date(filters.date);
				this.employeeIds = filters.employeeIds;
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadEmployees();
				}
			});

		this.store.user$.pipe(untilDestroyed(this)).subscribe((user: IUser) => {
			if (user && this.employeeIds.length === 0) {
				this.employeeIds = [user.employeeId];
			}
		});

		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
			});

		this.triggerFilterChange();
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
		this.triggerFilterChange();
	}

	triggerFilterChange(): void {
		this.updateLogs$.next();
	}

	celarFilters(): void {
		const obj = this.timesheetFilterService.clear();
		this.filters = obj;
		this.setDefaultEmplyee();
		this.updateLogs$.next();
	}

	private async loadEmployees(): Promise<void> {
		const { items = [] } = await this.employeesService.getWorking(
			this.organization.id,
			this.organization.tenantId,
			this.selectedDate,
			true
		);
		this.employees = items;
		this.setDefaultEmplyee();
	}

	setDefaultEmplyee() {
		if (
			this.employees &&
			this.employees.length > 0 &&
			this.employeeIds.length === 0
		) {
			this.filters.employeeIds = [this.employees[0].id];
			this._employeeIds = this.multipleEmployeSelect
				? [this.employees[0].id]
				: this.employees[0].id;
		}
	}

	hasFilter(): boolean {
		console.log(
			this._filters.employeeIds.length >= 2,
			this._filters.source.length >= 1,
			this._filters.logType.length >= 1,
			this._filters.projectIds.length >= 1,
			this.activityLevel.end < 100 || this.activityLevel.start > 0
		);
		return (
			this._filters.employeeIds.length >= 2 ||
			this._filters.source.length >= 1 ||
			this._filters.logType.length >= 1 ||
			this._filters.projectIds.length >= 1 ||
			this.activityLevel.end < 100 ||
			this.activityLevel.start > 0
		);
	}

	ngOnDestroy(): void {}
}

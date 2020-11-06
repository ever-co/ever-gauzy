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
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../@core/services/store.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Options, ChangeContext } from 'ng5-slider';
import { NgxPermissionsService } from 'ngx-permissions';
import {
	ActivityLevel,
	TimesheetFilterService
} from '../timesheet-filter.service';
import { debounceTime, filter, take, tap } from 'rxjs/operators';
import { isEmpty } from '@gauzy/utils';
import { NbCalendarRange } from '@nebular/theme';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-filters',
	templateUrl: './filters.component.html',
	styleUrls: ['./filters.component.scss']
})
export class FiltersComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date(moment().format('YYYY-MM-DD HH:mm:ss'));
	TimeLogType = TimeLogType;
	TimeLogSourceEnum = TimeLogSourceEnum;
	updateLogs$: Subject<any> = new Subject();

	@Input() dateRange: 'day' | 'week' | 'month' | 'custom_range' = 'day';
	private _filters: ITimeLogFilters = {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		activityLevel: ActivityLevel
	};
	futureDateAllowed: boolean;
	hasFilterApplies: boolean;
	isEmployee: boolean;
	private _dateRage: NbCalendarRange<Date>;

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

	activityLevel = ActivityLevel;
	sliderOptions: Partial<Options> = {
		floor: 0,
		ceil: 100,
		step: 5
	};
	organization: IOrganization;
	employees: IEmployee[];
	user: IUser;

	public get selectedDate(): Date {
		return this.filters.date as Date;
	}

	public set selectedDate(value: Date) {
		const date = value as Date;
		this.filters.date = date;
		const range = this.dateRange as 'day' | 'week' | 'month';
		this.filters.startDate = moment(date)
			.startOf(range)
			.format('YYYY-MM-DD HH:mm:ss');
		this.filters.endDate = moment(date)
			.endOf(range)
			.format('YYYY-MM-DD HH:mm:ss');

		this.triggerFilterChange();
	}

	get dateRage(): NbCalendarRange<Date> {
		return this._dateRage;
	}

	set dateRage(range: NbCalendarRange<Date>) {
		this._dateRage = range;
		if (range.start && range.end) {
			this.filters.startDate = moment(range.start).format(
				'YYYY-MM-DD HH:mm:ss'
			);
			this.filters.endDate = moment(range.end).format(
				'YYYY-MM-DD HH:mm:ss'
			);
			this.triggerFilterChange();
		}
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
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.isEmployee = user.employee ? true : false)),
				tap((user) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetFilterService.filter$
			.pipe(untilDestroyed(this), take(1))
			.subscribe((filters: ITimeLogFilters) => {
				this.filters = Object.assign({}, filters);
				this.selectedDate = new Date(filters.date);
				this.employeeIds = filters.employeeIds;
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadEmployees();
				}
			});
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.hasFilterApplies = this.hasFilter();
				Object.keys(this.filters).forEach((key) =>
					this.filters[key] === undefined
						? delete this.filters[key]
						: {}
				);
				this.filtersChange.emit(this.filters);
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
		const range = this.dateRange as 'day' | 'week' | 'month';
		const date = moment(this.selectedDate).add(1, range);
		if (!this.futureDateAllowed && date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	previousDay() {
		const range = this.dateRange as 'day' | 'week' | 'month';
		this.selectedDate = moment(this.selectedDate)
			.subtract(1, range)
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

	clearFilters(): void {
		const obj = this.timesheetFilterService.clear();
		this.filters = obj;
		this._employeeIds = [];
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
		const isNullFilterEmployeeIds = this.filters.employeeIds.length === 0;
		if (this.isEmployee && isNullFilterEmployeeIds) {
			const employeeId = this.store.user.employeeId;
			this.employeeIds = employeeId;
		}
	}

	onChangeEmployee($event) {
		this._employeeIds = $event;
	}

	hasFilter(): boolean {
		const idCount = this.isEmployee ? 2 : 1;
		return (
			this._filters.employeeIds.length >= idCount ||
			this._filters.source.length >= 1 ||
			this._filters.logType.length >= 1 ||
			this._filters.projectIds.length >= 1 ||
			this.activityLevel.end < 100 ||
			this.activityLevel.start > 0
		);
	}

	ngOnDestroy(): void {}
}

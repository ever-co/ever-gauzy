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
import { Options, ChangeContext } from 'ng5-slider';

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
	private _filters: TimeLogFilters = {
		employeeId: [],
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
					this.futureDateAllowed = organization.futureDateAllowed;
					this.loadEmployees();
				}
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
	async nextDay() {
		const date = moment(this.selectedDate).add(1, this.dateRange);
		if (!this.futureDateAllowed && date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	async previousDay() {
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
	}

	ngOnDestroy(): void {}
}

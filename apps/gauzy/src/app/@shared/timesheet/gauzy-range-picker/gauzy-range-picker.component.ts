import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { ChangeContext, Options } from 'ng5-slider';
import { NgxPermissionsService } from 'ngx-permissions';
import { isEmpty } from '@gauzy/common-angular';
import {
	IEmployee,
	IOrganization,
	ITimeLogFilters,
	IUser,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { debounceTime, filter, take, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services';
import { ActivityLevel, TimesheetFilterService } from '../timesheet-filter.service';
import { Arrow } from './arrow/context/arrow.class';
import { Future, Next, Previous } from './arrow/strategies/concrete';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-range-picker',
	templateUrl: './gauzy-range-picker.component.html',
	styleUrls: ['./gauzy-range-picker.component.scss']
})
export class GauzyRangePickerComponent
	implements AfterViewInit, OnInit, OnDestroy {

	// declaration of variables
	private arrow: Arrow;
	private next: Next;
	public isDisable: boolean;
	private updateLogs$: Subject<any> = new Subject();
	public PermissionsEnum = PermissionsEnum;
	public TimeLogType = TimeLogType;
	public TimeLogSourceEnum = TimeLogSourceEnum;
  public maxDate: moment.Moment;

	// define ngx-daterangepicker-material range configuration
	ranges: any = {
		'Today': [moment(), moment()],
		'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
		'Last 7 Days': [moment().subtract(6, 'days'), moment()],
		'Last 30 Days': [moment().subtract(29, 'days'), moment()],
		'This Month': [moment().startOf('month'), moment().endOf('month')],
		'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
	}
	// ngx-daterangepicker-material local configuration
	localConfig: any = {
		displayFormat: 'MMM DD, YYYY',
		format: 'YYYY-MM-DD'
	}
	// event emitter
	@Output()
	onDateChange: EventEmitter<Object> = new EventEmitter<Object>();

	// logRequest
  	@Input()
	public get filters(): ITimeLogFilters {
		return this._filters;
	}
  	@Input() saveFilters = true;
	@Input() hasProjectFilter = true;
	@Input() hasDateRangeFilter = true;
	@Input() hasEmployeeFilter = true;
	@Input() multipleEmployeeSelect = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;

  	private _selectedDateRange: any;
	get selectedDateRange(): any {
		return this._selectedDateRange;
	}

	set selectedDateRange(range) {
		this._selectedDateRange = range;
		this.filters.startDate = moment(range.startDate).format('YYYY-MM-DD');
		this.filters.endDate =
      !this.futureDateAllowed && (this.next.isDisable || moment(range.endDate).isSameOrAfter(moment())) ?
        moment().format('YYYY-MM-DD') :
        moment(range.endDate).format('YYYY-MM-DD');
		this.triggerFilterChange();
		this.cd.detectChanges();
	}

  	private _filters: ITimeLogFilters = {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		activityLevel: ActivityLevel,
		date: new Date()
	};

  	futureDateAllowed: boolean;
	hasFilterApplies: boolean;
	isEmployee: boolean;

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
   		this.filters = this.filters;
		this.triggerFilterChange();
	}

  	public set filters(value: ITimeLogFilters) {
		this._filters = value;
		this.activityLevel = {
			start: value.activityLevel ? value.activityLevel.start : 0,
			end: value.activityLevel ? value.activityLevel.end : 100
		};
		this.cd.detectChanges();
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

	// show or hide today button, show by default
	@Input()
	todayButton: boolean = true;

	// show or hide arrows button, hide by default
	@Input()
	arrows: boolean = false;

 	/**
   	* define constructor
   	*/
	constructor(
		private readonly store: Store,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly cd: ChangeDetectorRef
	) {
		this.arrow = new Arrow();
		this.next = new Next();
  	}

  	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.isEmployee = user.employee ? true : false)),
				tap((user) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		if (this.saveFilters) {
			this.timesheetFilterService.filter$
				.pipe(untilDestroyed(this), take(1))
				.subscribe((filters: ITimeLogFilters) => {
					this.filters = Object.assign({}, filters);
					this.selectedDate = new Date(filters.date);
					this.employeeIds = filters.employeeIds;
				});
		}
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
		this.updateLogs$
			.pipe(
				debounceTime(400),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.hasFilterApplies = this.hasFilter();
				Object.keys(this.filters).forEach((key) =>
					this.filters[key] === undefined
						? delete this.filters[key]
						: {}
				);
				this.onDateChange.emit(this.filters);
			});
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
        this.maxDate = this.futureDateAllowed ? null : moment();
        if (this.futureDateAllowed) {
          this.arrow.setStrategy = new Future();
          this.selectedDateRange = this.arrow.execute(this.selectedDateRange);
        }
			});
		this.triggerFilterChange();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
  	}

	/**
	 * listen event on ngx-daterangepicker-material
	 * @param event
	 */
  	onUpdate(event) {
		this.selectedDateRange =
		event.endDate || event.startDate ?
			{
				startDate: event.startDate.toDate(),
				endDate: event.endDate.toDate()
			} : this.filters;
		this.updateNextButton();
  	}

	/**
	 * get today selected date
	 */
	today() {
		this.selectedDateRange = {
			startDate: moment().toDate(),
			endDate: moment().toDate()
		}
		this.updateNextButton();
	}
	/**
	 * get next selected range
	 */
	nextRange() {
		this.arrow.setStrategy = this.next;
		this.selectedDateRange = this.arrow.execute(this.selectedDateRange);
    if (!this.futureDateAllowed && moment(this.selectedDateRange.endDate).isSameOrAfter(moment())) {
      this.previousRange();
      this.next.isDisable = true;
    }
		this.isDisable = this.next.isDisable;
	}

   /**
   * get previous selected range
   */
	previousRange() {
		this.updateNextButton();
		this.arrow.setStrategy = new Previous();
		this.selectedDateRange = this.arrow.execute(this.selectedDateRange);
	}

  	/**
   * update state: disable next button
   */
	updateNextButton() {
		if (this.next.isDisable) {
			this.next.isDisable = false;
			this.isDisable = false
		};
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
		this.updateLogs$.next(true);
	}

	clearFilters(): void {
		const obj = this.timesheetFilterService.clear();
		this.filters = obj;
		if (this.multipleEmployeeSelect) {
			this._employeeIds = [];
		} else {
			this._employeeIds = '';
		}
		this.setDefaultEmployee();
		this.updateLogs$.next(true);
	}

	setDefaultEmployee() {
		const isNullFilterEmployeeIds =
			this.filters.employeeIds && this.filters.employeeIds.length === 0;
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
			(this._filters.employeeIds &&
				this._filters.employeeIds.length >= idCount) ||
			(this._filters.source && this._filters.source.length >= 1) ||
			(this._filters.logType && this._filters.logType.length >= 1) ||
			(this._filters.projectIds &&
				this._filters.projectIds.length >= 1) ||
			(this.activityLevel && this.activityLevel.end < 100) ||
			(this.activityLevel && this.activityLevel.start > 0)
		);
	}

	ngOnDestroy(): void {}
}

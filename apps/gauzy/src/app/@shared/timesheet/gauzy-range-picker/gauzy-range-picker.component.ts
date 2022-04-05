import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ChangeContext, Options } from 'ng5-slider';
import {
	IDateRangePicker,
	IOrganization,
	ITimeLogFilters,
	PermissionsEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, take, tap } from 'rxjs/operators';
import { distinctUntilChange } from '@gauzy/common-angular';
import { Store } from '../../../@core/services';
import { ActivityLevel, TimesheetFilterService } from '../timesheet-filter.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-range-picker',
	templateUrl: './gauzy-range-picker.component.html',
	styleUrls: ['./gauzy-range-picker.component.scss']
})
export class GauzyRangePickerComponent
	implements AfterViewInit, OnInit, OnDestroy {

	// declaration of variables
	public PermissionsEnum = PermissionsEnum;
	public TimeLogType = TimeLogType;
	public TimeLogSourceEnum = TimeLogSourceEnum;

  	@Input() saveFilters = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;

	hasFilterApplies: boolean;

  	activityLevel = ActivityLevel;
	sliderOptions: Partial<Options> = {
		floor: 0,
		ceil: 100,
		step: 5
	};
	organization: IOrganization;

	/*
	* Getter & Setter for dynamic selected date range
	*/
	_selectedDateRange: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangePicker) {
		this._selectedDateRange = range;
		this.filters = {
			...this.filters,
			...this.selectedDateRange
		}
		this.triggerFilterChange();
	}
	
	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	private filters$: Subject<any> = new Subject();
	private _filters: ITimeLogFilters = {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		activityLevel: ActivityLevel
	};
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(value: ITimeLogFilters) {
		this._filters = value;
		this.activityLevel = {
			start: value.activityLevel ? value.activityLevel.start : 0,
			end: value.activityLevel ? value.activityLevel.end : 100
		};
		this.cd.detectChanges();
	}

	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

 	/**
   	* define constructor
   	*/
	constructor(
		private readonly store: Store,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly cd: ChangeDetectorRef
	) {}

  	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				filter(([organization]) => !!organization),
				debounceTime(300),
				distinctUntilChange(),
				tap(([organization, selectedDateRange]) => {
					this.organization = organization;
					this.selectedDateRange = selectedDateRange;
				}),
				untilDestroyed(this)
			)
			.subscribe();
		if (this.saveFilters) {
			this.timesheetFilterService.filter$
				.pipe(
					tap((filters: ITimeLogFilters) => {
						this.filters = Object.assign({}, filters)
					}),
					take(1),
					untilDestroyed(this)
				)
				.subscribe();
		}
		this.filters$
			.pipe(
				debounceTime(400),
				tap(() => this.hasFilterApplies = this.hasFilter()),
				untilDestroyed(this)
			)
			.subscribe(() => {
				Object.keys(this.filters).forEach((key) =>
					this.filters[key] === undefined
						? delete this.filters[key]
						: {}
				);
				this.filtersChange.emit(this.filters);
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
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
		this.filters$.next(true);
	}

	clearFilters(): void {
		this.filters = this.timesheetFilterService.clear();
		this.filters$.next(true);
	}

	hasFilter(): boolean {
		return (
			(this._filters.source && this._filters.source.length >= 1) ||
			(this._filters.logType && this._filters.logType.length >= 1) ||
			(this.activityLevel && this.activityLevel.end < 100) ||
			(this.activityLevel && this.activityLevel.start > 0)
		);
	}

	ngOnDestroy(): void {}
}

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
	ITimeLogFilters,
	PermissionsEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { debounceTime, take, tap } from 'rxjs/operators';
import { pick } from 'underscore';
import { ActivityLevel, TimesheetFilterService } from '../timesheet-filter.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-filters',
	templateUrl: './gauzy-filters.component.html',
	styleUrls: ['./gauzy-filters.component.scss']
})
export class GauzyFiltersComponent
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
	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	private filters$: Subject<any> = new Subject();
	private _filters: ITimeLogFilters = {
		source: [],
		logType: [],
		activityLevel: ActivityLevel
	};
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.activityLevel = {
				start: filters.activityLevel ? filters.activityLevel.start : 0,
				end: filters.activityLevel ? filters.activityLevel.end : 100
			};
		}
		this.cd.detectChanges();
	}

	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

 	/**
   	* define constructor
   	*/
	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly cd: ChangeDetectorRef
	) {}

  	ngOnInit() {
		if (this.saveFilters) {
			this.timesheetFilterService.filter$
				.pipe(
					take(1),
					tap((filters: ITimeLogFilters) => {
						this.filters = Object.assign({}, pick(
							filters,
							'source',
							'activityLevel',
							'logType'
						));
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
		this.filters$
			.pipe(
				debounceTime(400),
				tap(() => this.hasFilterApplies = this.hasFilter()),
				tap(() => this.filtersChange.emit(this.arrangedFilters())),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.triggerFilterChange();
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
		this.triggerFilterChange();
	}

	hasFilter(): boolean {
		return (
			(this._filters.source && this._filters.source.length >= 1) ||
			(this._filters.logType && this._filters.logType.length >= 1) ||
			(this.activityLevel && this.activityLevel.end < 100) ||
			(this.activityLevel && this.activityLevel.start > 0)
		);
	}

	arrangedFilters(): ITimeLogFilters {
		Object.keys(this.filters).forEach((key) =>
			this.filters[key] === undefined ? delete this.filters[key] : {}
		);
		return this.filters;
	}

	ngOnDestroy(): void {}
}

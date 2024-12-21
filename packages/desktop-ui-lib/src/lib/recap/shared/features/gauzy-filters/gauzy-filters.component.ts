import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ChangeContext, Options } from '@angular-slider/ngx-slider';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs';
import { ITimeLogFilters, PermissionsEnum, TimeFormatEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-gauzy-filters',
    templateUrl: './gauzy-filters.component.html',
    styleUrls: ['./gauzy-filters.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class GauzyFiltersComponent implements OnInit, OnDestroy {
	// declaration of variables
	public PermissionsEnum = PermissionsEnum;
	public TimeLogType = TimeLogType;
	public TimeLogSourceEnum = TimeLogSourceEnum;

	@Input() saveFilters = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;
	@Input() hasTimeZoneFilter = true;

	public hasFilterApplies: boolean;
	public activityLevel = { start: 0, end: 100 };
	public sliderOptions: Partial<Options> = {
		floor: 0,
		ceil: 100,
		step: 5,
		animate: true,
		keyboardSupport: true,
		autoHideLimitLabels: true
	};
	public readonly timeLogSourceSelectors = this.getTimeLogSourceSelectors();

	private readonly defaultFilter: ITimeLogFilters = {
		source: [TimeLogSourceEnum.DESKTOP],
		logType: [],
		activityLevel: {
			start: 0,
			end: 100
		}
	};

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	private _filters: ITimeLogFilters = this.defaultFilter;

	public get filters(): ITimeLogFilters {
		return this._filters;
	}

	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.activityLevel = filters.activityLevel || this.activityLevel;
		}
	}

	@Input() isTimeFormat: boolean = false;

	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

	/**
	 * define constructor
	 */
	constructor(public readonly translateService: TranslateService) {}

	ngOnInit() {
		this.filtersChange
			.asObservable()
			.pipe(
				tap(() => (this.hasFilterApplies = this.hasFilter())),
				untilDestroyed(this)
			)
			.subscribe();
		this.hasFilterApplies = this.hasFilter();
	}

	/**
	 * Sets the activity level filter based on the provided ChangeContext.
	 *
	 * @param activity - The change context containing the new activity level values.
	 */
	public setActivityLevel(activity: ChangeContext): void {
		this.filters.activityLevel = {
			start: activity.value,
			end: activity.highValue
		};
		this.activityLevel = this.filters.activityLevel;
		this.notifyFilterChange();
	}

	public setSource(source: TimeLogSourceEnum[]) {
		this.filters.source = source;
		this.notifyFilterChange();
	}

	public setLogType(type: TimeLogType[]) {
		this.filters.logType = type;
		this.notifyFilterChange();
	}

	/**
	 * Notify the filter change event.
	 */
	public notifyFilterChange(): void {
		this.filtersChange.emit(this.filters);
	}

	/**
	 * Clears all filters and triggers a filter change.
	 */
	public clearFilters(): void {
		this.filters = this.defaultFilter;
		this.notifyFilterChange();
	}

	/**
	 * Checks if any filters are currently applied.
	 *
	 * @returns True if any filters are applied, otherwise false.
	 */
	public hasFilter(): boolean {
		return (
			(this.filters.source && this.filters.source.length >= 1) ||
			(this.filters.logType && this.filters.logType.length >= 1) ||
			(this.activityLevel && this.activityLevel.end < 100) ||
			(this.activityLevel && this.activityLevel.start > 0)
		);
	}

	/**
	 * Handles the event when the time format is changed.
	 *
	 * @param timeFormat The new time format.
	 */
	public timeFormatChanged(timeFormat: TimeFormatEnum): void {
		this.filters.timeFormat = timeFormat;
		this.notifyFilterChange();
	}

	/**
	 * Handles the event when the time zone is changed.
	 *
	 * @param timezone The new time zone.
	 */
	public timeZoneChanged(timeZone: string): void {
		this.filters.timeZone = timeZone;
		this.notifyFilterChange();
	}

	/**
	 * Generate Dynamic Timelog Source Selector
	 */
	public getTimeLogSourceSelectors(): Array<{ label: string; value: TimeLogSourceEnum }> {
		return Object.keys(TimeLogSourceEnum).map((key) => ({
			label: this.translateService.instant(`TIMESHEET.SOURCES.${key}`),
			value: TimeLogSourceEnum[key as keyof typeof TimeLogSourceEnum]
		}));
	}

	ngOnDestroy(): void {}
}

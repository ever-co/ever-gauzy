import { ChangeContext, Options } from '@angular-slider/ngx-slider';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import { ITimeLogFilters, PermissionsEnum, TimeFormatEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { debounceTime, take, tap } from 'rxjs/operators';
import { pick } from 'underscore';
import { TimesheetFilterService } from '../../../services/timesheet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-filters',
	templateUrl: './gauzy-filters.component.html',
	styleUrls: ['./gauzy-filters.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class GauzyFiltersComponent implements AfterViewInit, OnInit, OnDestroy {
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

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	private filters$: Subject<any> = new Subject();
	private _filters: ITimeLogFilters = {
		timeFormat: TimeFormatEnum.FORMAT_12_HOURS,
		source: [],
		logType: [],
		activityLevel: {
			start: 0,
			end: 100
		}
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
	}
	@Input() isTimeformat: boolean = false;

	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

	/**
	 * define constructor
	 */
	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService
	) {}

	ngOnInit() {
		if (this.saveFilters) {
			this.timesheetFilterService.filter$
				.pipe(
					take(1),
					tap((filters: ITimeLogFilters) => {
						this.filters = Object.assign({}, pick(filters, 'source', 'activityLevel', 'logType'));
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
		this.filters$
			.pipe(
				debounceTime(400),
				tap(() => (this.hasFilterApplies = this.hasFilter())),
				tap(() => this.filtersChange.emit(this.arrangedFilters())),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.triggerFilterChange();
	}

	/**
	 * Sets the activity level filter based on the provided ChangeContext.
	 *
	 * @param activity - The change context containing the new activity level values.
	 */
	setActivityLevel(activity: ChangeContext): void {
		this.filters.activityLevel = {
			start: activity.value,
			end: activity.highValue
		};
		this.activityLevel = this.filters.activityLevel;
		this.triggerFilterChange();
	}

	/**
	 * Triggers the filter change event.
	 */
	triggerFilterChange(): void {
		this.filters$.next(true);
	}

	/**
	 * Clears all filters and triggers a filter change.
	 */
	clearFilters(): void {
		this.filters = this.timesheetFilterService.clear();
		this.triggerFilterChange();
	}

	/**
	 * Checks if any filters are currently applied.
	 *
	 * @returns True if any filters are applied, otherwise false.
	 */
	hasFilter(): boolean {
		return (
			(this._filters.source && this._filters.source.length >= 1) ||
			(this._filters.logType && this._filters.logType.length >= 1) ||
			(this.activityLevel && this.activityLevel.end < 100) ||
			(this.activityLevel && this.activityLevel.start > 0)
		);
	}

	/**
	 *
	 * @returns
	 */
	arrangedFilters(): ITimeLogFilters {
		Object.keys(this.filters).forEach((key) => (this.filters[key] === undefined ? delete this.filters[key] : {}));
		return this.filters;
	}

	/**
	 * Handles the event when the time format is changed.
	 *
	 * @param timeFormat The new time format.
	 */
	timeFormatChanged(timeFormat: TimeFormatEnum): void {
		this.filters.timeFormat = timeFormat;
		this.triggerFilterChange();
	}

	/**
	 * Handles the event when the time zone is changed.
	 *
	 * @param timezone The new time zone.
	 */
	timeZoneChanged(timeZone: string): void {
		this.filters.timeZone = timeZone;
		this.triggerFilterChange();
	}

	/**
	 * Generate Dynamic Timelog Source Selector
	 */
	getTimeLogSourceSelectors(): Array<{ label: string; value: TimeLogSourceEnum }> {
		return [
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.WEB_TIMER'),
				value: TimeLogSourceEnum.WEB_TIMER
			},
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.DESKTOP'),
				value: TimeLogSourceEnum.DESKTOP
			},
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.MOBILE'),
				value: TimeLogSourceEnum.MOBILE
			},
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.UPWORK'),
				value: TimeLogSourceEnum.UPWORK
			},
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.HUBSTAFF'),
				value: TimeLogSourceEnum.HUBSTAFF
			},
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.BROWSER_EXTENSION'),
				value: TimeLogSourceEnum.BROWSER_EXTENSION
			},
			{
				label: this.translateService.instant('TIMESHEET.SOURCES.TEAMS'),
				value: TimeLogSourceEnum.TEAMS
			}
		];
	}

	ngOnDestroy(): void {}
}

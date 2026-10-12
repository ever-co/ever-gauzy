import {
	AfterViewInit,
	booleanAttribute,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	HostBinding,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pick } from 'underscore';
import { Options, ChangeContext } from '@angular-slider/ngx-slider';
import { ITimeLogFilters, PermissionsEnum, TimeFormatEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ActivityLevel, TimesheetFilterService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-gauzy-filters',
    templateUrl: './gauzy-filters.component.html',
    styleUrls: ['./gauzy-filters.component.scss'],
    standalone: false
})
export class GauzyFiltersComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	// declaration of variables
	public PermissionsEnum = PermissionsEnum;
	public TimeLogType = TimeLogType;
	public TimeLogSourceEnum = TimeLogSourceEnum;

	@Input() saveFilters = true;
	@Input() hasLogTypeFilter = true;
	@Input() hasSourceFilter = true;
	@Input() hasActivityLevelFilter = true;
	@Input() hasTimeZoneFilter = true;

	/**
	 * Layout opt-ins for the filter strip.
	 *
	 * Every box this component renders is a bootstrap `.col-auto`, i.e.
	 * `flex: 0 0 auto`, so the strip is shrink-to-fit at every level: a host that
	 * gives it a wide container still gets a strip the width of its own controls.
	 * These flags exist so a host can change that WITHOUT reaching into this
	 * template - the boxes involved are private to this component, and
	 * `::ng-deep` is the only other way to touch them.
	 *
	 * `fullWidth` lets the strip span its container, keeps the controls against
	 * the trailing edge, and lets them wrap to a second line instead of
	 * overflowing. Use it where the host has room for the controls on one line
	 * and the shrink-to-fit cap is what is denying it to them.
	 *
	 * `compact` narrows each filter column, for a host fitting more controls onto
	 * that line than this component renders on its own - one projecting an extra
	 * control through `<ng-content>`, for instance.
	 *
	 * Both are reflected onto the host element, which is what the stylesheet keys
	 * off.
	 */
	@HostBinding('class.full-width')
	@Input({ transform: booleanAttribute })
	fullWidth: boolean = false;

	@HostBinding('class.compact')
	@Input({ transform: booleanAttribute })
	compact: boolean = false;

	public hasFilterApplies: boolean;
	public activityLevel = ActivityLevel;
	public sliderOptions: Partial<Options> = {
		floor: 0,
		ceil: 100,
		step: 5
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
	@Input() isTimeFormat: boolean = false;

	@Output() filtersChange: EventEmitter<ITimeLogFilters> = new EventEmitter();

	/**
	 * define constructor
	 */
	constructor(
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly cd: ChangeDetectorRef,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

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
		this.cd.detectChanges();
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
				label: this.getTranslation('TIMESHEET.SOURCES.WEB_TIMER'),
				value: TimeLogSourceEnum.WEB_TIMER
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.DESKTOP'),
				value: TimeLogSourceEnum.DESKTOP
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.MOBILE'),
				value: TimeLogSourceEnum.MOBILE
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.UPWORK'),
				value: TimeLogSourceEnum.UPWORK
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.HUBSTAFF'),
				value: TimeLogSourceEnum.HUBSTAFF
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.BROWSER_EXTENSION'),
				value: TimeLogSourceEnum.BROWSER_EXTENSION
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.TEAMS'),
				value: TimeLogSourceEnum.TEAMS
			},
			{
				label: this.getTranslation('TIMESHEET.SOURCES.CLOC'),
				value: TimeLogSourceEnum.CLOC
			}
		];
	}

	ngOnDestroy(): void {}
}

import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import {
	IGetTimeLogReportInput,
	IReportDayData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { pick } from 'underscore';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslateService } from '@ngx-translate/core';
import { ActivityService, DateRangePickerBuilderService, Store } from '@gauzy/ui-core/core';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { BaseSelectorFilterComponent, TimeZoneService } from '../../timesheet/gauzy-filters';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-activities-report-grid',
    templateUrl: './activities-report-grid.component.html',
    styleUrls: ['./activities-report-grid.component.scss'],
    standalone: false
})
export class ActivitiesReportGridComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	dailyData: IReportDayData[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	private _filters: ITimeLogFilters;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(value: ITimeLogFilters) {
		this._filters = value || {};
		this.subject$.next(true);
	}

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly activityService: ActivityService,
		public readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly cdr: ChangeDetectorRef,
		public readonly translateService: TranslateService,
		public readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getActivitiesReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	/**
	 * Change by group filter
	 */
	groupByChange() {
		this.subject$.next(true);
	}

	/**
	 * Get activities report
	 *
	 * @returns {Promise<void>}
	 */
	async getActivitiesReport(): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous data if necessary
		this.dailyData = [];

		// Set loading to true before the request
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch new activities report
			const newReportData = await this.activityService.getDailyActivitiesReport(payloads);

			// Update dailyData with the newly fetched report
			this.dailyData = newReportData as IReportDayData[];
		} catch (error) {
			// Log the error and optionally notify the user
			console.error('Error while retrieving daily activities report', error);
			// Optionally: this.notificationService.showError('Failed to load daily activities report.');
		} finally {
			// Ensure loading is set to false after completion
			this.loading = false;
		}
	}
}

import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { pick } from 'underscore';
import {
	IGetTimeLogReportInput,
	IReportDayData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { Environment, environment } from '@gauzy/ui-config';
import { distinctUntilChange, isEmpty, progressStatus } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetService } from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, TimeZoneService } from '../../timesheet/gauzy-filters';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-daily-grid',
    templateUrl: './daily-grid.component.html',
    styleUrls: ['./daily-grid.component.scss'],
    standalone: false
})
export class DailyGridComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit, OnDestroy {
	// This constant holds the URL for downloading content from the platform's website.
	readonly PLATFORM_WEBSITE_DOWNLOAD_URL: Environment['PLATFORM_WEBSITE_DOWNLOAD_URL'] =
		environment.PLATFORM_WEBSITE_DOWNLOAD_URL;

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	dailyLogs: IReportDayData[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	ReportGroupFilterEnum = ReportGroupFilterEnum;

	/*
	 * Getter & Setter for dynamic filters
	 */
	private _filters: ITimeLogFilters = this.request;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.subject$.next(true);
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
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
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Change by group filter
	 */
	groupByChange() {
		this.subject$.next(true);
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		// Check if organization or filters are not provided, return early if true
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}

		// Pick specific properties ('source', 'activityLevel', 'logType') from this.filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		// Create a request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			// Set the 'groupBy' property from the current instance's 'groupBy' property
			groupBy: this.groupBy
		};

		// Emit the request object to the observable
		this.payloads$.next(request);
	}

	/**
	 * Retrieves daily logs if the organization and request are set.
	 *
	 * @returns {Promise<void>}
	 */
	async getLogs(): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear current data
		this.dailyLogs = [];

		// Set loading to true to indicate that the logs are being fetched
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch new daily logs data
			const newLogs = await this.timesheetService.getDailyReport(payloads);

			// Update dailyLogs with the newly fetched data
			this.dailyLogs = newLogs;
		} catch (error) {
			// Log the error and provide meaningful feedback to the user if necessary
			console.error('Error while retrieving daily logs report', error);
			// Optionally: Show a notification or alert to the user about the error
			// this.notificationService.showError('Failed to load daily logs.');
		} finally {
			// Ensure that loading is set to false whether the request was successful or not
			this.loading = false;
		}
	}

	public getStatus(value: number) {
		return progressStatus(value);
	}

	ngOnDestroy() {}
}

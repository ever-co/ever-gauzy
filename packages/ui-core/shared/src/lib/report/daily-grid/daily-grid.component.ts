import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	inject,
	Input,
	OnDestroy,
	OnInit,
	ChangeDetectionStrategy
} from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
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
import { distinctUntilChange, isEmpty, LatestRequest, progressStatus } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetService } from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, TimeZoneService } from '../../timesheet/gauzy-filters';
import { buildReportExportFileName, ReportExportFormatEnum, ReportExportService } from '../export';
import { buildDailyReportExportTable, DAILY_REPORT_EXPORT_NAME } from './daily-report-export';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-daily-grid',
	templateUrl: './daily-grid.component.html',
	styleUrls: ['./daily-grid.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class DailyGridComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit, OnDestroy {
	// This constant holds the URL for downloading content from the platform's website.
	readonly PLATFORM_WEBSITE_DOWNLOAD_URL: Environment['PLATFORM_WEBSITE_DOWNLOAD_URL'] =
		environment.PLATFORM_WEBSITE_DOWNLOAD_URL;

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	dailyLogs: IReportDayData[] = [];
	loading: boolean;
	ReportGroupFilterEnum = ReportGroupFilterEnum;

	@Input() showGroupBy: boolean = true;

	private readonly reportExportService = inject(ReportExportService);

	/**
	 * Keeps the report requests in order: every filter or grouping change starts one, and they can overlap. Only
	 * the latest may show its rows and end the loading state; an older answer that lands later is dropped.
	 */
	private readonly reportRequests = new LatestRequest();

	/** The request the rows on screen answer; `null` while the latest request is pending or failed. */
	private loadedRequest: IGetTimeLogReportInput | null = null;

	/*
	 * Getter & Setter for the group-by filter
	 */
	private _groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	get groupBy(): ReportGroupByFilter {
		return this._groupBy;
	}
	@Input() set groupBy(groupBy: ReportGroupByFilter) {
		if (!groupBy || groupBy === this._groupBy) {
			return;
		}
		this._groupBy = groupBy;
		this.subject$.next(true);
	}

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
	 * Requests can overlap (each filter or grouping change starts one while the previous may still be pending), so
	 * only the latest started applies its answer: an older one that lands later neither replaces the newer rows nor
	 * ends the loading state the newer request still holds.
	 *
	 * @returns {Promise<void>} Settles when this request has answered, whether its answer was applied or dropped.
	 */
	async getLogs(): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// The request to send (the latest payload), and its place in the sequence of requests
		const payloads = this.payloads$.getValue() as IGetTimeLogReportInput;
		const ticket = this.reportRequests.start();

		// Clear current data: the rows on screen no longer answer the current filters
		this.dailyLogs = [];
		this.loadedRequest = null;

		// Set loading to true to indicate that the logs are being fetched
		this.loading = true;

		try {
			// Fetch new daily logs data
			const newLogs = await this.timesheetService.getDailyReport(payloads);

			// A newer request started meanwhile: its answer, not this one, belongs on screen
			if (!this.reportRequests.isLatest(ticket)) {
				return;
			}

			// Update dailyLogs with the newly fetched data
			this.dailyLogs = newLogs;
			this.loadedRequest = payloads;
		} catch (error) {
			// Only the latest request's failure is the report's; a superseded one no longer matters
			if (this.reportRequests.isLatest(ticket)) {
				console.error('Error while retrieving daily logs report', error);
			}
		} finally {
			// Only the latest request ends the loading state: while a newer one is pending, the grid is still loading
			if (this.reportRequests.isLatest(ticket)) {
				this.loading = false;
			}
		}
	}

	/**
	 * Whether there is anything to export: the latest report request has answered with time entries, so the rows
	 * on screen belong to the current filters, in the grouping the grid shows.
	 */
	get canExport(): boolean {
		return !this.loading && this.dailyLogs?.length > 0 && this.loadedRequest?.groupBy === this.groupBy;
	}

	/**
	 * Downloads the time entries the grid shows — for the current filters, in its current grouping — as a file
	 * named after the report and the selected date range.
	 *
	 * It only serialises what the grid already fetched, so it exports exactly what the caller can see; it does
	 * nothing while that is not the answer to the current filters and grouping (see `canExport`).
	 *
	 * @param format - The format to export to: CSV, or one a plugin registered through `REPORT_EXPORTERS`.
	 * @param reportName - What the file name starts with, before the date range.
	 */
	exportReport(format: string = ReportExportFormatEnum.CSV, reportName: string = DAILY_REPORT_EXPORT_NAME): void {
		if (!this.canExport) {
			return;
		}
		// Read the rows in the grouping they were requested in: their shape depends on it
		const table = buildDailyReportExportTable(this.dailyLogs, this.loadedRequest.groupBy, (key) =>
			this.getTranslation(key)
		);
		this.reportExportService.export(table, {
			fileName: buildReportExportFileName(reportName, this.request?.startDate, this.request?.endDate),
			format
		});
	}

	public getStatus(value: number) {
		return progressStatus(value);
	}

	ngOnDestroy() {}
}

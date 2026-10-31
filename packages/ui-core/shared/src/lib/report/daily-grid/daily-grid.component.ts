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
import { distinctUntilChange, isEmpty, progressStatus } from '@gauzy/ui-core/common';
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

	/**
	 * Whether there is anything to export: the report has finished loading and found time entries.
	 */
	get canExport(): boolean {
		return !this.loading && this.dailyLogs?.length > 0;
	}

	/**
	 * Downloads the time entries the grid shows — for the current filters, in its current grouping — as a file
	 * named after the report and the selected date range.
	 *
	 * It only serialises what the grid already fetched, so it exports exactly what the caller can see.
	 *
	 * @param format - The format to export to: CSV, or one a plugin registered through `REPORT_EXPORTERS`.
	 * @param reportName - What the file name starts with, before the date range.
	 */
	exportReport(format: string = ReportExportFormatEnum.CSV, reportName: string = DAILY_REPORT_EXPORT_NAME): void {
		if (!this.canExport) {
			return;
		}
		const table = buildDailyReportExportTable(this.dailyLogs, this.groupBy, (key) => this.getTranslation(key));
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

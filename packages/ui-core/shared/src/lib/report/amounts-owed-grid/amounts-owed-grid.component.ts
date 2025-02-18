import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import {
	IAmountOwedReport,
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { DateRangePickerBuilderService, Store, TimesheetService } from '@gauzy/ui-core/core';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { BaseSelectorFilterComponent, TimeZoneService } from '../../timesheet/gauzy-filters';
import { DateFormatPipe, DurationFormatPipe } from '../../pipes';
import { generateCsv } from '../../generate-csv-pdf';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-amounts-owed-grid',
	templateUrl: './amounts-owed-grid.component.html',
	styleUrls: ['./amounts-owed-grid.component.scss']
})
export class AmountsOwedGridComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public loading: boolean;
	public groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	public dailyData: IAmountOwedReport[];

	/**
	 *
	 */
	private _filters: ITimeLogFilters;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(value: ITimeLogFilters) {
		this._filters = value || {};
		this.subject$.next(true);
	}

	private payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService,
		private readonly dateFormatPipe: DateFormatPipe,
		private readonly durationFormatPipe: DurationFormatPipe
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
				tap(() => this.getAmountsOwed()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Get header selectors request and Gauzy timesheet filters request.
	 */
	prepareRequest(): void {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Create a request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};

		// Notify subscribers about the filter change
		this.payloads$.next(request);
	}

	/**
	 * Updates Gauzy timesheet default filters and notifies subscribers about the change.
	 *
	 * @param filters - An object representing time log filters (ITimeLogFilters).
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Create a shallow copy of the filters and update the class property
		this.filters = { ...filters };

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}

	/**
	 * Asynchronously retrieves amounts owed reports, updates the 'dailyData' property, and handles the loading state.
	 *
	 * @returns {Promise<void>}
	 */
	async getAmountsOwed(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous data and set the loading flag to true
		this.dailyData = [];
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the owed amount report data from the timesheetService
			this.dailyData = await this.timesheetService.getOwedAmountReport(payloads);
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving amounts owed reports:', error);
			// Optionally: this.notificationService.showError('Failed to retrieve amounts owed reports.');
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}

	exportToCsv() {
		const data = [];
		if (!this.dailyData || !Array.isArray(this.dailyData)) {
			//TODO: replace with GZY-108: Error Handling on the Web Page
			console.error('dailyData is undefined or not an array', this.dailyData);
			return;
		}

		this.dailyData.forEach((entry) => {
			if (!entry.employees || !Array.isArray(entry.employees)) {
				console.log('No employees found for entry:', entry);
				return;
			}

			entry.employees.forEach((employee) => {
				const employeeFullName = employee?.employee?.fullName || 'N/A';
				const billRateValue = employee?.employee?.billRateValue || 'N/A';

				const rowData = {
					date: this.dateFormatPipe.transform(entry?.date),
					employee: employeeFullName,
					currentRate: billRateValue,
					hours: this.durationFormatPipe.transform(employee?.duration) || 0,
					amount: employee?.amount || '0.00'
				};

				data.push(rowData);
			});
		});

		if (!data || data.length === 0) {
			console.error('No valid data to export');
			return;
		}

		const headers = [
			this.getTranslation('REPORT_PAGE.DATE'),
			this.getTranslation('REPORT_PAGE.EMPLOYEE'),
			this.getTranslation('REPORT_PAGE.CURRENT_RATE'),
			this.getTranslation('REPORT_PAGE.HOURS'),
			this.getTranslation('REPORT_PAGE.AMOUNT')
		];

		const fileName = this.getTranslation('REPORT_PAGE.AMOUNT_OWED');
		generateCsv(data, headers, fileName);
	}
}

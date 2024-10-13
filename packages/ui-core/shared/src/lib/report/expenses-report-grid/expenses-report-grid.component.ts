import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	IExpenseReportData,
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, ExpensesService, Store } from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, TimeZoneService } from '../../timesheet/gauzy-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expenses-report-grid',
	templateUrl: './expenses-report-grid.component.html',
	styleUrls: ['./expenses-report-grid.component.scss']
})
export class ExpensesReportGridComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	dailyData: IExpenseReportData[] = [];
	loading: boolean = false;
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
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly expensesService: ExpensesService,
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
				tap(() => this.getExpensesReport()),
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
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy,
			...(this.filters?.categoryId ? { categoryId: this.filters?.categoryId } : {})
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
	 * Asynchronously fetches the daily expense report.
	 *
	 * @returns {Promise<void>}
	 */
	async getExpensesReport(): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous data and set loading state to true
		this.dailyData = [];
		this.loading = true;

		try {
			// Get current payload values from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the daily expenses report from the service
			this.dailyData = await this.expensesService.getDailyExpensesReport(payloads);
		} catch (error) {
			// Log the error and optionally notify the user
			console.error('Error while retrieving expense reports:', error);
			// Optionally: this.notificationService.showError('Failed to load daily expense report.');
		} finally {
			// Reset the loading state
			this.loading = false;
		}
	}
}

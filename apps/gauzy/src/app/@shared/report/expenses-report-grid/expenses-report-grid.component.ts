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
import { distinctUntilChange, isEmpty } from '@gauzy/ui-sdk/common';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { ExpensesService, Store } from '../../../@core/services';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

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
		private readonly expensesService: ExpensesService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService, dateRangePickerBuilderService);
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
	 * Get expense report
	 *
	 * @returns
	 */
	async getExpensesReport() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			this.dailyData = await this.expensesService.getDailyExpensesReport(payloads);
		} catch (error) {
			console.log('Error while retrieving expense reports', error);
		} finally {
			this.loading = false;
		}
	}
}

import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import {
	IGetExpenseInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pluck } from 'underscore';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, ExpensesService, Store } from './../../../../@core/services';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expenses-report',
	templateUrl: './expenses-report.component.html',
	styleUrls: ['./expenses-report.component.scss']
})
export class ExpensesReportComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	filters: ITimeLogFilters;
	loading: boolean = false;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly expensesService: ExpensesService,
		private readonly cd: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
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
				tap(() => this.updateChart()),
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
		const request: IGetExpenseInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	async updateChart() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			const logs: any[] = await this.expensesService.getReportChartData(payloads);
			const datasets = [{
				label: this.getTranslation('REPORT_PAGE.EXPENSE'),
				data: logs.map((log) => log.value['expense']),
				borderColor: ChartUtil.CHART_COLORS.red,
				backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 1),
				borderWidth: 1,
				pointRadius: 2,
				pointHoverRadius: 7,
				pointHoverBorderWidth: 6,
			}];
			this.chartData = {
				labels: pluck(logs, 'date'),
				datasets
			};
		} catch (error) {
			console.log('Error while retrieving expense reports chart', error);
		} finally {
			this.loading = false;
		}
	}
}

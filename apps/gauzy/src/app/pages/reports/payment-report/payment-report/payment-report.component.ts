import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import { IGetPaymentInput, IPaymentReportChartData, ITimeLogFilters, ReportGroupByFilter, ReportGroupFilterEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { pluck } from 'underscore';
import { isEmpty } from '@gauzy/common-angular';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { DateRangePickerBuilderService, PaymentService, Store } from './../../../../@core/services';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-report',
	templateUrl: './payment-report.component.html',
	styleUrls: ['./payment-report.component.scss']
})
export class PaymentReportComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {
		
	loading: boolean;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	filters: IGetPaymentInput;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly paymentService: PaymentService,
		private readonly cd: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

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
		const request: IGetPaymentInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.loading = true;
		try {
			const logs: IPaymentReportChartData[] = await this.paymentService.getReportChartData(request);
			const datasets = [{
				label: this.getTranslation('REPORT_PAGE.PAYMENT'),
				data: logs.map((log) => log.value['payment']),
				borderColor: ChartUtil.CHART_COLORS.red,
				backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 0.5),
				borderWidth: 1
			}];
			this.chartData = {
				labels: pluck(logs, 'date'),
				datasets
			};
		} catch (error) {
			console.log('Error while retrieving payment reports chart', error);
		} finally {
			this.loading = false;
		}
	}
}

import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetPaymentInput, IPaymentReportChartData, ReportGroupByFilter, ReportGroupFilterEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, tap } from 'rxjs/operators';
import { pluck } from 'underscore';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { PaymentService, Store } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-report',
	templateUrl: './payment-report.component.html',
	styleUrls: ['./payment-report.component.scss']
})
export class PaymentReportComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: IGetPaymentInput = this.request;
	loading: boolean;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	filters: IGetPaymentInput;

	constructor(
		private readonly paymentService: PaymentService,
		private readonly cd: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.subject$.next(true);
	}

	updateChart() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const request: IGetPaymentInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.paymentService
			.getReportChartData(request)
			.then((logs: IPaymentReportChartData[]) => {
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
			})
			.finally(() => (this.loading = false));
	}
}

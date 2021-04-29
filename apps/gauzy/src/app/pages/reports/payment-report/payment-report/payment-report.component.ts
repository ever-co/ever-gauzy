import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetPaymentInput, IPaymentReportChartData } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { PaymentService } from './../../../../@core/services/payment.service';
import { Store } from './../../../../@core/services/store.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { debounceTime } from 'rxjs/operators';
import { pluck } from 'underscore';

@UntilDestroy()
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
	chartData: any;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';
	filters: IGetPaymentInput;

	constructor(
		private paymentService: PaymentService,
		private cd: ChangeDetectorRef,
		protected store: Store,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(debounceTime(500), untilDestroyed(this))
			.subscribe(() => {
				this.updateChartData();
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.subject$.next();
	}

	updateChartData() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const request: IGetPaymentInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.loading = true;
		this.paymentService
			.getReportChartData(request)
			.then((logs: IPaymentReportChartData[]) => {
				const datasets = [
					{
						label: this.getTranslation('REPORT_PAGE.EXPANSE'),
						data: logs.map((log) => log.value)
					}
				];
				this.chartData = {
					labels: pluck(logs, 'date'),
					datasets
				};
			})
			.finally(() => (this.loading = false));
	}
}

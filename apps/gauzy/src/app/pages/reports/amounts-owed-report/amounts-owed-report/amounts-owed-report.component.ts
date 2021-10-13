import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput, ReportGroupFilterEnum, ReportGroupByFilter } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, tap } from 'rxjs/operators';
import { pluck } from 'underscore';
import { Store } from './../../../../@core/services/store.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-amounts-owed-report',
	templateUrl: './amounts-owed-report.component.html',
	styleUrls: ['./amounts-owed-report.component.scss']
})
export class AmountsOwedReportComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: IGetExpenseInput = this.request;
	loading: boolean;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	filters: IGetExpenseInput;

	constructor(
		private readonly timesheetService: TimesheetService,
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
				tap(() => this.updateChartData()),
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

	updateChartData() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const request: IGetExpenseInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.timesheetService
			.getOwedAmountReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [{
					label: this.getTranslation('REPORT_PAGE.AMOUNT'),
					data: logs.map((log) => log.value),
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

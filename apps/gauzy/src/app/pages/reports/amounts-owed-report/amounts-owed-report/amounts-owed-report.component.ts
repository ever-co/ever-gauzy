import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput, ReportGroupFilterEnum, ReportGroupByFilter, ITimeLogFilters } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, tap } from 'rxjs/operators';
import { pluck } from 'underscore';
import { isEmpty } from '@gauzy/common-angular';
import { Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-amounts-owed-report',
	templateUrl: './amounts-owed-report.component.html',
	styleUrls: ['./amounts-owed-report.component.scss']
})
export class AmountsOwedReportComponent extends BaseSelectorFilterComponent
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
				tap(() => this.updateChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.filters = Object.assign(
			{},
			this.logRequest,
			getAdjustDateRangeFutureAllowed(this.logRequest)
		);
		this.subject$.next(true);
	}

	updateChart() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		this.loading = true;
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
			})
			.finally(() => (this.loading = false));
	}
}

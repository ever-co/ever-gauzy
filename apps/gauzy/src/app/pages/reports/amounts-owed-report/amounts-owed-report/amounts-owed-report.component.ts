import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import { IGetExpenseInput, ReportGroupFilterEnum, ReportGroupByFilter, ITimeLogFilters } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { pluck } from 'underscore';
import { isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart/line-chart.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-amounts-owed-report',
	templateUrl: './amounts-owed-report.component.html',
	styleUrls: ['./amounts-owed-report.component.scss']
})
export class AmountsOwedReportComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	loading: boolean = false;
	chartData: IChartData;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	filters: IGetExpenseInput;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly timesheetService: TimesheetService,
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
		this.loading = true;
		const request: IGetExpenseInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};

		try {
			const logs: any = await this.timesheetService.getOwedAmountReportChartData(request);
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
		} catch (error) {
			console.log('Error while retrieving amounts owed chart', error);
		} finally {
			this.loading = false;
		}
	}
}

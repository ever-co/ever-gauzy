import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from './../../../../@core/services/store.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { debounceTime, tap } from 'rxjs/operators';
import { pluck } from 'underscore';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';

@UntilDestroy()
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
	chartData: any;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';
	filters: IGetExpenseInput;

	constructor(
		private timesheetService: TimesheetService,
		private cd: ChangeDetectorRef,
		protected store: Store,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(1350),
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
		this.subject$.next();
	}

	updateChartData() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const request: IGetExpenseInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getOwedAmountReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: this.getTranslation('REPORT_PAGE.AMOUNT'),
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

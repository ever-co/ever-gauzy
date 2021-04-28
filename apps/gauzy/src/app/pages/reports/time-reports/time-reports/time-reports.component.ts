import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	ITimeLogFilters,
	TimeLogType
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from './../../../../@core/services/store.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { debounceTime, tap } from 'rxjs/operators';
import * as _ from 'underscore';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy()
@Component({
	selector: 'ga-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: ITimeLogFilters = this.request;
	filters: ITimeLogFilters;
	loading: boolean;
	chartData: any;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';

	constructor(
		private timesheetService: TimesheetService,
		protected store: Store,
		readonly translateService: TranslateService,
		private cd: ChangeDetectorRef
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
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getDailyReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: TimeLogType.MANUAL,
						data: logs.map((log) => log.value[TimeLogType.MANUAL])
					},
					{
						label: TimeLogType.TRACKED,
						data: logs.map((log) => log.value[TimeLogType.TRACKED])
					}
				];
				this.chartData = {
					labels: _.pluck(logs, 'date'),
					datasets
				};
			})
			.finally(() => (this.loading = false));
	}
}

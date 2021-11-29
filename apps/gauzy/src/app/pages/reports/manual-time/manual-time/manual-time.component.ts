import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	ITimeLog,
	ITimeLogFilters,
	TimeLogType
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { debounceTime, tap } from 'rxjs/operators';
import { chain, pick } from 'underscore';
import { ReportBaseComponent } from 'apps/gauzy/src/app/@shared/report/report-base/report-base.component';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy()
@Component({
	selector: 'ga-manual-time',
	templateUrl: './manual-time.component.html',
	styleUrls: ['./manual-time.component.scss']
})
export class ManualTimeComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: ITimeLogFilters = this.request;
	filters: ITimeLogFilters;
	loading: boolean;
	dailyData: any;

	constructor(
		private cd: ChangeDetectorRef,
		private timesheetService: TimesheetService,
		protected store: Store,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(1350),
				tap(() => this.getLogs()),
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

	async getLogs() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
			logType: [TimeLogType.MANUAL],
			relations: ['task', 'project', 'employee', 'employee.user']
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request)
			.then((logs: ITimeLog[]) => {
				this.dailyData = chain(logs)
					.groupBy((log: ITimeLog) => {
						return moment(log.updatedAt).format('YYYY-MM-DD');
					})
					.map((timeLogs, date) => {
						return {
							date,
							timeLogs
						};
					})
					.value();
			})
			.finally(() => (this.loading = false));
	}
}

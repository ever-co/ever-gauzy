import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IGetTimeLogReportInput,
	ITimeLog,
	ITimeLogFilters,
	TimeLogType
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { chain, pick } from 'underscore';
import { Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manual-time-report',
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
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
    	private readonly activatedRoute: ActivatedRoute
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
		this.activatedRoute.queryParams
			.pipe(
				filter((params) => !!params && params.start),
				tap((params) => this.filtersChange({
					startDate: moment(params.start).startOf('week').toDate(),
					endDate: moment(params.end).endOf('week').toDate()
				}))
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
				console.log(this.dailyData)
			})
			.finally(() => (this.loading = false));
	}
}

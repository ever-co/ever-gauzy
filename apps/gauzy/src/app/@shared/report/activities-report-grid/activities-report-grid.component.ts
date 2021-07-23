import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IReportDayData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import { ActivityService } from '../../timesheet/activity.service';
import { ReportBaseComponent } from '../report-base/report-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-activities-report-grid',
	templateUrl: './activities-report-grid.component.html',
	styleUrls: ['./activities-report-grid.component.scss']
})
export class ActivitiesReportGridComponent extends ReportBaseComponent implements OnInit, AfterViewInit {
	
	logRequest: ITimeLogFilters = this.request;
	dailyData: IReportDayData[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	@Input()
	set filters(value: ITimeLogFilters) {
		this.logRequest = value || {};
		this.subject$.next();
	}

	constructor(
		private readonly activityService: ActivityService,
		public readonly store: Store,
		private readonly cd: ChangeDetectorRef,
		public readonly translateService: TranslateService,
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.loading = true),
				tap(() => this.getActivities()),
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

	groupByChange() {
		this.subject$.next();
	}

	getActivities() {
		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.activityService
			.getDailyActivitiesReport(request)
			.then((logs: IReportDayData[]) => {
				this.dailyData = logs;
			})
			.catch((error) => {})
			.finally(() => (this.loading = false));
	}
}

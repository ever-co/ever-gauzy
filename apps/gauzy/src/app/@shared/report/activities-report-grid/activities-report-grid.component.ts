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
import { isEmpty } from '@gauzy/common-angular';
import { Store } from '../../../@core/services';
import { ActivityService } from '../../timesheet/activity.service';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-activities-report-grid',
	templateUrl: './activities-report-grid.component.html',
	styleUrls: ['./activities-report-grid.component.scss']
})
export class ActivitiesReportGridComponent extends BaseSelectorFilterComponent 
	implements OnInit, AfterViewInit {
	
	logRequest: ITimeLogFilters = this.request;
	dailyData: IReportDayData[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	@Input()
	set filters(value: ITimeLogFilters) {
		this.logRequest = value || {};
		this.subject$.next(true);
	}

	constructor(
		private readonly activityService: ActivityService,
		public readonly store: Store,
		private readonly cdr: ChangeDetectorRef,
		public readonly translateService: TranslateService,
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.cdr.detectChanges();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.loading = true),
				tap(() => this.getActivities()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	groupByChange() {
		this.subject$.next(true);
	}

	getActivities() {
		if (!this.organization || isEmpty(this.logRequest)) {
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

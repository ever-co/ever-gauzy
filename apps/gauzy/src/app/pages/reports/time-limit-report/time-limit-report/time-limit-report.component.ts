import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IGetTimeLimitReportInput,
	ITimeLimitReport,
	ITimeLogFilters
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { isEmpty } from '@gauzy/common-angular';
import { Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-limit-report',
	templateUrl: './time-limit-report.component.html',
	styleUrls: ['./time-limit-report.component.scss']
})
export class TimeLimitReportComponent extends BaseSelectorFilterComponent 
	implements OnInit, AfterViewInit {

	logRequest: IGetTimeLimitReportInput = this.request;
	filters: ITimeLogFilters;
	loading: boolean;
	dailyData: any;
	title: string;
	duration: 'day' | 'week' | 'month';

	constructor(
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		protected readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit(): void {
		this.activatedRoute.data
			.pipe(
				tap((data) => {
					this.duration = data.duration || 'day';
					this.title = data.title;
				}),
				untilDestroyed(this)
			).subscribe();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.subject$.next(true);
	}

	getLogs() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		const request: IGetTimeLimitReportInput = {
			...this.getFilterRequest(this.logRequest),
			duration: this.duration,
			relations: ['task', 'project', 'employee', 'employee.user']
		};
		this.loading = true;
		this.timesheetService
			.getTimeLimit(request)
			.then((logs: ITimeLimitReport[]) => {
				this.dailyData = logs;
			})
			.finally(() => (this.loading = false));
	}
}

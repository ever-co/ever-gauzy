import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
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
import { Observable } from 'rxjs/internal/Observable';
import { chain, pick } from 'underscore';
import { isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manual-time-report',
	templateUrl: './manual-time.component.html',
	styleUrls: ['./manual-time.component.scss']
})
export class ManualTimeComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	filters: ITimeLogFilters;
	loading: boolean;
	dailyData: any;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
    	private readonly activatedRoute: ActivatedRoute,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(500),
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

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	getLogs() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
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

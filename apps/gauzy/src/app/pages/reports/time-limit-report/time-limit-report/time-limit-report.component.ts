import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IGetTimeLimitReportInput,
	ITimeLimitReport,
	ITimeLogFilters
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-limit-report',
	templateUrl: './time-limit-report.component.html',
	styleUrls: ['./time-limit-report.component.scss']
})
export class TimeLimitReportComponent extends BaseSelectorFilterComponent 
	implements OnInit, AfterViewInit {

	filters: ITimeLogFilters;
	loading: boolean = false;
	dailyData: any;
	title: string;
	duration: 'day' | 'week' | 'month';

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
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
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	async getLogs() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const request: IGetTimeLimitReportInput = {
			...this.getFilterRequest(this.request),
			duration: this.duration,
			relations: ['task', 'project', 'employee', 'employee.user']
		};

		this.loading = true;
		try {
			const limits: ITimeLimitReport[] = await this.timesheetService.getTimeLimit(request);
			this.dailyData = limits;
		} catch (error) {
			console.log(`Error while retrieving ${this.title} time limit report`, error);
		} finally {
			this.loading = false;
		}
	}
}

import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IProjectBudgetLimitReport,
	ITimeLogFilters,
	OrganizationProjectBudgetTypeEnum,
	ReportGroupByFilter,
	ReportGroupFilterEnum
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
	selector: 'ga-project-budgets-report',
	templateUrl: './project-budgets-report.component.html',
	styleUrls: ['./project-budgets-report.component.scss']
})
export class ProjectBudgetsReportComponent extends BaseSelectorFilterComponent 
	implements OnInit, AfterViewInit {
		
	loading: boolean = false;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	projects: IProjectBudgetLimitReport[] = [];
	filters: ITimeLogFilters;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getReportData()),
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

	async getReportData() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		try {
			const projects: IProjectBudgetLimitReport[] = await this.timesheetService.getProjectBudgetLimit(request);
			this.projects = projects;
		} catch (error) {
			console.log('Error while retrieving project budget chart', error);
		} finally {
			this.loading = false;
		}
	}
}

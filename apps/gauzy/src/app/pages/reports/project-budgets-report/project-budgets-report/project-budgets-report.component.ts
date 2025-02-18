import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslateService } from '@ngx-translate/core';
import {
	IGetTimeLogReportInput,
	IProjectBudgetLimitReport,
	ITimeLogFilters,
	OrganizationProjectBudgetTypeEnum,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetFilterService, TimesheetService } from '@gauzy/ui-core/core';
import {
	BaseSelectorFilterComponent,
	DurationFormatPipe,
	GauzyFiltersComponent,
	generateCsv,
	TimeZoneService
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-budgets-report',
	templateUrl: './project-budgets-report.component.html',
	styleUrls: ['./project-budgets-report.component.scss']
})
export class ProjectBudgetsReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public loading = false;
	public groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	public OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	public projects: IProjectBudgetLimitReport[] = [];
	public filters: ITimeLogFilters;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService,
		private readonly durationFormatPipe: DurationFormatPipe
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getProjectBudgetReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Prepares the request by applying filters and updating the payloads observable.
	 */
	prepareRequest(): void {
		// Check if either this.request or this.filters is empty, resolve without further action
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Create the request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};

		// Update the payloads observable with the new request
		this.payloads$.next(request);
	}

	/**
	 * Updates Gauzy timesheet default filters, saves the filters if configured to do so,
	 * and notifies subscribers about the change.
	 *
	 * @param filters - An object representing time log filters (ITimeLogFilters).
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Save filters to the timesheetFilterService if configured to do so
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}

		// Create a shallow copy of the filters and update the class property
		this.filters = { ...filters };

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}

	/**
	 * Asynchronously retrieves project budget reports, updates the 'projects' property, and handles the loading state.
	 *
	 * @returns {Promise<void>}
	 */
	async getProjectBudgetReport(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous project data and set the loading flag to true
		this.projects = [];
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the project budget reports from the timesheetService
			this.projects = await this.timesheetService.getProjectBudgetLimit(payloads);
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving project budget chart:', error);
			// Optionally: this.notificationService.showError('Failed to retrieve project budget reports.');
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}

	exportToCsv() {
		const data = [];
		this.projects.forEach((entry) => {
			const projectName = entry?.project.name;
			const membersCount = entry?.project?.membersCount || 'N/A';
			const spent =
				entry.project.budgetType === OrganizationProjectBudgetTypeEnum.HOURS
					? `${this.durationFormatPipe.transform(entry?.spent * 3600 || 0)} ${this.getTranslation(
							'REPORT_PAGE.HOURS'
					  )}`
					: entry?.spent || 0;
			const remaining =
				entry.project.budgetType === OrganizationProjectBudgetTypeEnum.HOURS
					? `${this.durationFormatPipe.transform(entry?.remainingBudget * 3600 || 0)} ${this.getTranslation(
							'REPORT_PAGE.HOURS'
					  )}`
					: entry?.remainingBudget || 0;
			const budget =
				entry.project.budgetType === OrganizationProjectBudgetTypeEnum.HOURS
					? `${this.durationFormatPipe.transform(entry?.budget * 3600 || 0)} ${this.getTranslation(
							'REPORT_PAGE.HOURS'
					  )}`
					: entry?.budget || 0;

			const rowData = {
				project: `${projectName} ${this.getTranslation('SM_TABLE.MEMBERS_COUNT')}: ${membersCount}`,
				employeesOrTeams: '-',
				spent: spent,
				remaining: remaining,
				spentPercentage: budget + ` ${entry?.spentPercentage || 0}%`
			};

			data.push(rowData);
		});

		if (!data.length) {
			console.error('No valid data to export');
			return;
		}
		const headers = [
			this.getTranslation('REPORT_PAGE.PROJECT'),
			this.getTranslation('REPORT_PAGE.EMPLOYEES/TEAMS'),
			this.getTranslation('REPORT_PAGE.SPENT'),
			this.getTranslation('REPORT_PAGE.REMAINING'),
			this.getTranslation('REPORT_PAGE.BUDGET')
		];

		const fileName = this.getTranslation('REPORT_PAGE.PROJECT_BUDGET_REPORTS');
		generateCsv(data, headers, fileName);
	}
}

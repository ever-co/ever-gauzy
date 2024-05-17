import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import {
	IGetTimeLogReportInput,
	IProjectBudgetLimitReport,
	ITimeLogFilters,
	OrganizationProjectBudgetTypeEnum,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-sdk/common';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { Store } from './../../../../@core/services';
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
export class ProjectBudgetsReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public loading: boolean = false;
	public groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	public OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	public projects: IProjectBudgetLimitReport[] = [];
	public filters: ITimeLogFilters;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
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

		// Determine the current timezone using moment-timezone
		const timezone: string = moment.tz.guess();

		// Create the request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy,
			// Set the 'timezone' property to the determined timezone
			timezone
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
	 * retrieves project budget reports, updates the 'projects' property, and handles loading state.
	 *
	 * @returns
	 */
	async getProjectBudgetReport(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set the loading flag to true
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the project budget reports from the timesheetService
			const projects: IProjectBudgetLimitReport[] = await this.timesheetService.getProjectBudgetLimit(payloads);

			// Update the 'projects' property with the retrieved data
			this.projects = projects;
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving project budget chart', error);
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}
}

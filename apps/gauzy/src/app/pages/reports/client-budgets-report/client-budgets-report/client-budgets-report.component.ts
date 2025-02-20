import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import {
	IGetPaymentInput,
	IGetTimeLogReportInput,
	IClientBudgetLimitReport,
	OrganizationContactBudgetTypeEnum,
	ITimeLogFilters
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
	selector: 'ga-client-budgets-report',
	templateUrl: './client-budgets-report.component.html',
	styleUrls: ['./client-budgets-report.component.scss']
})
export class ClientBudgetsReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	OrganizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;
	loading = false;
	filters: IGetPaymentInput;
	clients: IClientBudgetLimitReport[] = [];

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		public readonly translateService: TranslateService,
		private readonly timesheetService: TimesheetService,
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
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
				tap(() => this.getClientBudgetReport()),
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

		// Extract clientIds from this.request
		const appliedFilter = pick(this.request, 'clientIds');

		// Create the request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
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
	 * Asynchronously retrieves client budget reports and updates the 'clients' property.
	 *
	 * @returns {Promise<void>}
	 */
	async getClientBudgetReport(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous client data and set the loading flag to true
		this.clients = [];
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the client budget reports from the timesheetService
			this.clients = await this.timesheetService.getClientBudgetLimit(payloads);
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving client budget reports:', error);
			// Optionally: this.notificationService.showError('Failed to retrieve client budget reports.');
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}

	exportToCsv() {
		const data = [];
		this.clients.forEach((entry) => {
			const spent =
				entry.budgetType === OrganizationContactBudgetTypeEnum.HOURS
					? `${this.durationFormatPipe.transform(entry?.spent * 3600 || 0)} ${this.getTranslation(
							'REPORT_PAGE.HOURS'
					  )}`
					: entry?.spent || 0;
			const remaining =
				entry.budgetType === OrganizationContactBudgetTypeEnum.HOURS
					? `${this.durationFormatPipe.transform(entry?.remainingBudget * 3600 || 0)} ${this.getTranslation(
							'REPORT_PAGE.HOURS'
					  )}`
					: entry?.remainingBudget || 0;
			const budget =
				entry.budgetType === OrganizationContactBudgetTypeEnum.HOURS
					? `${this.durationFormatPipe.transform(entry?.budget * 3600 || 0)} ${this.getTranslation(
							'REPORT_PAGE.HOURS'
					  )}`
					: entry?.budget || 0;

			const rowData = {
				client: entry.organizationContact.name || 'N/A',
				employeesOrTeams: '-',
				spent: spent,
				remaining: remaining,
				budget,
				spentPercentage: `${entry?.spentPercentage || 0}%`
			};

			data.push(rowData);
		});

		if (!data.length) {
			console.error('No valid data to export');
			return;
		}
		const headers = [
			this.getTranslation('REPORT_PAGE.CLIENT'),
			this.getTranslation('REPORT_PAGE.EMPLOYEES/TEAMS'),
			this.getTranslation('REPORT_PAGE.SPENT'),
			this.getTranslation('REPORT_PAGE.REMAINING'),
			this.getTranslation('REPORT_PAGE.BUDGET')
		];

		const fileName = this.getTranslation('REPORT_PAGE.CLIENT_BUDGET_REPORTS');
		generateCsv(data, headers, fileName);
	}
}

import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pick } from 'underscore';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import {
	IGetPaymentInput,
	IGetTimeLogReportInput,
	IClientBudgetLimitReport,
	OrganizationContactBudgetTypeEnum,
	ITimeLogFilters
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-client-budgets-report',
	templateUrl: './client-budgets-report.component.html',
	styleUrls: ['./client-budgets-report.component.scss']
})
export class ClientBudgetsReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	OrganizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;
	loading: boolean = false;
	filters: IGetPaymentInput;
	clients: IClientBudgetLimitReport[] = [];

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

		// Determine the current timezone using moment-timezone
		const timezone: string = moment.tz.guess();

		// Extract clientIds from this.request
		const appliedFilter = pick(this.request, 'clientIds');

		// Create the request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
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
	 * retrieves client budget reports, updates the 'clients' property,
	 *
	 * @returns
	 */
	async getClientBudgetReport(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set the loading flag to true
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the client budget reports from the timesheetService
			const clients: IClientBudgetLimitReport[] = await this.timesheetService.getClientBudgetLimit(payloads);

			// Update the 'clients' property with the retrieved data
			this.clients = clients;
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving client budget reports', error);
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}
}

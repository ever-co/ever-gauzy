import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import {
	ICurrency,
	IGetPaymentInput,
	IOrganizationContact,
	IPaymentReportChartData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pluck } from 'underscore';
import * as moment from 'moment';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-sdk/common';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { PaymentService, Store } from './../../../../@core/services';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-report',
	templateUrl: './payment-report.component.html',
	styleUrls: ['./payment-report.component.scss']
})
export class PaymentReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public filters: IGetPaymentInput;
	public loading: boolean;
	public charts: IChartData;
	private groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	public datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	public payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	constructor(
		private readonly paymentService: PaymentService,
		private readonly cd: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				// Filters out emissions when 'this.organization' is falsy
				filter(() => !!this.organization),
				// Performs a side effect: invokes 'this.prepareRequest()'
				tap(() => this.prepareRequest()),
				// Ensures that the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				// Ensures that consecutive emissions are distinct
				distinctUntilChange(),
				// Filters out falsy payloads
				filter((payloads: ITimeLogFilters) => !!payloads),
				// Performs a side effect: invokes 'this.updateChart()'
				tap(() => this.updateChart()),
				// Ensures that the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Prepares the request by applying filters, updating the groupBy property, and updating the payloads observable.
	 */
	private prepareRequest(): void {
		// Check if either this.request or this.filters is empty, resolve without further action
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Determine the current timezone using moment-timezone
		const timezone: string = moment.tz.guess();

		// Create the request object of type IGetPaymentInput
		const request: IGetPaymentInput = {
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
	public filtersChange(filters: ITimeLogFilters): void {
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
	 * Updates the chart with payment report data.
	 *
	 * @returns
	 */
	private async updateChart(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set the loading flag to true
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch payment report chart data from the paymentService
			const logs: IPaymentReportChartData[] = await this.paymentService.getPaymentsReportCharts(payloads);

			// Extract payment values and create a dataset
			const datasets = [
				{
					label: this.getTranslation('REPORT_PAGE.PAYMENT'), // Label for the dataset, translated using a translation function
					data: logs.map((log) => log.value['payment']), // Array of data points for the dataset, extracted from 'logs'
					borderColor: ChartUtil.CHART_COLORS.red, // Color of the dataset border
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 0.5), // Background color with transparency
					borderWidth: 2, // Width of the dataset border
					pointRadius: 2, // Radius of the data points
					pointHoverRadius: 4, // Radius of the data points on hover
					pointHoverBorderWidth: 4, // Width of the border of data points on hover
					tension: 0.4, // Tension of the spline curve connecting data points
					fill: false // Whether to fill the area under the line or not
				}
			];

			// Update the chart data with the retrieved data
			this.charts = {
				labels: pluck(logs, 'date'),
				datasets
			};
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving payment reports chart', error);
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}

	/*
	 * On Changed Contact Event Emitter
	 */
	contactChanged(contact: IOrganizationContact) {}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged(currency: ICurrency) {}
}

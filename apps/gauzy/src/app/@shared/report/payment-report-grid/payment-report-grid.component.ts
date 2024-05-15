import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import {
	IGetTimeLogReportInput,
	IPaymentReportData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { PaymentService, Store } from '../../../@core/services';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-report-grid',
	templateUrl: './payment-report-grid.component.html',
	styleUrls: ['./payment-report-grid.component.scss']
})
export class PaymentReportGridComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	dailyData: IPaymentReportData[] = [];
	loading: boolean = false;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	private _filters: ITimeLogFilters;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(value: ITimeLogFilters) {
		this._filters = value || {};
		this.subject$.next(true);
	}

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly paymentService: PaymentService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
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
				tap(() => this.getPaymentReport()),
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
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Determine the current timezone using moment-timezone
		const timezone: string = moment.tz.guess();

		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy,
			// Set the 'timezone' property to the determined timezone
			timezone
		};
		this.payloads$.next(request);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters): void {
		this.filters = { ...filters };
		this.subject$.next(true);
	}

	/**
	 * Change by group filter
	 */
	groupByChange() {
		this.subject$.next(true);
	}

	/**
	 * Retrieves payment report based on the provided request parameters.
	 *
	 * @returns A Promise that resolves to the payment report data.
	 */
	async getPaymentReport(): Promise<void> {
		// Check if the organization and request are available
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set loading to true
		this.loading = true;

		try {
			// Get the request payloads
			const payloads = this.payloads$.getValue();

			// Retrieve payments report using the service
			this.dailyData = await this.paymentService.getPaymentsReport(payloads);
		} catch (error) {
			console.log('Error while retrieving payments reports', error);
		} finally {
			// Set loading to false
			this.loading = false;
		}
	}
}

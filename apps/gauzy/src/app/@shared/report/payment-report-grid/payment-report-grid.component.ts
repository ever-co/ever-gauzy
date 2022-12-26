import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IPaymentReportData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { DateRangePickerBuilderService, PaymentService, Store } from '../../../@core/services';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-report-grid',
	templateUrl: './payment-report-grid.component.html',
	styleUrls: ['./payment-report-grid.component.scss']
})
export class PaymentReportGridComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

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
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Change by group filter
	 */
	groupByChange() {
		this.subject$.next(true);
	}

	/**
	 * Get payment report
	 *
	 * @returns
	 */
	async getPaymentReport() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			this.dailyData = await this.paymentService.getReportData(payloads);
		} catch (error) {
			console.log('Error while retrieving payments reports', error);
		} finally {
			this.loading = false;
		}
	}
}

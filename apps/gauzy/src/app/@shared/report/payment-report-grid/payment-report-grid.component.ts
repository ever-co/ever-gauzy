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
import { isEmpty } from '@gauzy/common-angular';
import { debounceTime, tap } from 'rxjs/operators';
import { PaymentService, Store } from '../../../@core/services';
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

	constructor(
		private readonly paymentService: PaymentService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(1350),
				tap(() => this.getPayment()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	groupByChange() {
		this.subject$.next(true);
	}

	async getPayment() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.loading = true;
		try {
			this.dailyData = await this.paymentService.getReportData(request);
		} catch (error) {
			console.log('Error while retrieving payments reports', error);
		} finally {
			this.loading = false;
		}
	}
}

import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IGetPaymentInput,
	IGetTimeLogReportInput,
	IPaymentReportData,
	ISelectedEmployee,
	OrganizationPermissionsEnum,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { isEmpty } from '@gauzy/common-angular';
import { debounceTime } from 'rxjs/operators';
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

	logRequest: IGetPaymentInput = this.request;
	dailyData: IPaymentReportData[] = [];
	weekDayList: string[] = [];
	loading: boolean;

	futureDateAllowed: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	selectedEmployee: ISelectedEmployee;

	@Input()
	set filters(value) {
		this.logRequest = value || {};
		this.subject$.next(true);
	}

	constructor(
		private readonly paymentService: PaymentService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(debounceTime(1350), untilDestroyed(this))
			.subscribe(() => {
				this.getPayment();
			});
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.subject$.next(true);
	}

	groupByChange() {
		this.subject$.next(true);
	}

	async getPayment() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}

		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};

		this.loading = true;
		this.paymentService
			.getReportData(request)
			.then((logs) => {
				this.dailyData = logs;
			})
			.catch(() => {})
			.finally(() => (this.loading = false));
	}
}

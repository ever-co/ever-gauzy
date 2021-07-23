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
	PermissionsEnum,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime } from 'rxjs/operators';
import { PaymentService } from '../../../@core/services/payment.service';
import { Store } from '../../../@core/services/store.service';
import { ReportBaseComponent } from '../report-base/report-base.component';

@UntilDestroy()
@Component({
	selector: 'ga-payment-report-grid',
	templateUrl: './payment-report-grid.component.html',
	styleUrls: ['./payment-report-grid.component.scss']
})
export class PaymentReportGridComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
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
		this.subject$.next();
	}

	constructor(
		private paymentService: PaymentService,
		private ngxPermissionsService: NgxPermissionsService,
		protected store: Store,
		readonly translateService: TranslateService,
		private cd: ChangeDetectorRef
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
		this.subject$.next();
	}

	groupByChange() {
		this.subject$.next();
	}

	async getPayment() {
		if (!this.organization || !this.logRequest) {
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

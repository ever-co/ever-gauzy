import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetPaymentInput,
	IGetTimeLogReportInput,
	IClientBudgetLimitReport,
	OrganizationContactBudgetTypeEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import { Store } from './../../../../@core/services/store.service';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-client-budgets-report',
	templateUrl: './client-budgets-report.component.html',
	styleUrls: ['./client-budgets-report.component.scss']
})
export class ClientBudgetsReportComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: IGetPaymentInput = this.request;
	OrganizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;
	loading: boolean;
	filters: IGetPaymentInput;
	clients: IClientBudgetLimitReport[];

	constructor(
		private readonly timesheetService: TimesheetService,
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
				tap(() => this.loading = true),
				tap(() => this.getReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.subject$.next(true);
	}

	async getReport() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const appliedFilter = pick(this.logRequest, 'clientIds');
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest)
		};
		this.timesheetService
			.getClientBudgetLimit(request)
			.then((logs: IClientBudgetLimitReport[]) => {
				this.clients = logs;
			})
			.catch(() => {})
			.finally(() => (this.loading = false));
	}
}

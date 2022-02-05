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
import { Arrow } from 'apps/gauzy/src/app/@shared/report/common/arrow.class';

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
  arrow: Arrow;
  isDisable : boolean;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService);
    this.arrow = new Arrow(this.logRequest);
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

  next(){
    this.arrow.setLogRequest = this.logRequest;
    this.logRequest = this.arrow.next(this.today);
    this.isDisable = this.arrow.isDisable;
    this.cd.detectChanges();
  }

  previous(){
    this.arrow.setLogRequest = this.logRequest;
    this.logRequest = this.arrow.previous();
    this.isDisable = this.arrow.isDisable;
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

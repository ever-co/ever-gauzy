import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IExpenseReportData,
	IGetTimeLogReportInput,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime } from 'rxjs/operators';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { Store } from '../../../@core/services/store.service';
import { ReportBaseComponent } from '../report-base/report-base.component';

@UntilDestroy()
@Component({
	selector: 'ga-expenses-report-grid',
	templateUrl: './expenses-report-grid.component.html',
	styleUrls: ['./expenses-report-grid.component.scss']
})
export class ExpensesReportGridComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	logRequest: ITimeLogFilters = this.request;

	dailyData: IExpenseReportData[] = [];
	weekDayList: string[] = [];
	loading: boolean;

	futureDateAllowed: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	@Input()
	set filters(value) {
		this.logRequest = value || {};
		this.subject$.next();
	}

	constructor(
		private expensesService: ExpensesService,
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
				this.getExpenses();
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

	async getExpenses() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.loading = true;
		this.expensesService
			.getDailyExpensesReport(request)
			.then((logs) => {
				this.dailyData = logs;
			})
			.catch(() => {})
			.finally(() => (this.loading = false));
	}
}

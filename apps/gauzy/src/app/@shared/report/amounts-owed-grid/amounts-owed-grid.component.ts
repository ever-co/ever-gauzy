import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IAmountOwedReport,
	IGetTimeLogReportInput,
	ISelectedEmployee,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { debounceTime, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { TranslateService } from '@ngx-translate/core';
import { ReportBaseComponent } from '../report-base/report-base.component';

@UntilDestroy()
@Component({
	selector: 'ga-amounts-owed-grid',
	templateUrl: './amounts-owed-grid.component.html',
	styleUrls: ['./amounts-owed-grid.component.scss']
})
export class AmountsOwedGridComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = this.request;

	weekDayList: string[] = [];
	loading: boolean;

	futureDateAllowed: boolean;
	groupBy: 'date' | 'employee' | 'project' = 'date';
	selectedEmployee: ISelectedEmployee;
	dailyData: IAmountOwedReport[];

	@Input()
	set filters(value) {
		this.logRequest = value || {};
		this.subject$.next();
	}

	constructor(
		private timesheetService: TimesheetService,
		private ngxPermissionsService: NgxPermissionsService,
		protected store: Store,
		private cd: ChangeDetectorRef,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(1350),
				tap(() => this.getExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
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

	getExpenses() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getOwedAmountReport(request)
			.then((logs) => {
				this.dailyData = logs;
			})
			.catch(() => {})
			.finally(() => (this.loading = false));
	}
}

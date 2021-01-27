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
	IOrganization,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { pick } from 'underscore';
import { Store } from '../../../@core/services/store.service';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { TimesheetService } from '../../timesheet/timesheet.service';

@UntilDestroy()
@Component({
	selector: 'ga-amounts-owed-grid',
	templateUrl: './amounts-owed-grid.component.html',
	styleUrls: ['./amounts-owed-grid.component.scss']
})
export class AmountsOwedGridComponent implements OnInit, AfterViewInit {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	today: Date = new Date();
	logRequest: ITimeLogFilters = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;

	weekDayList: string[] = [];
	loading: boolean;

	private _selectedDate: Date = new Date();
	futureDateAllowed: boolean;
	groupBy: 'date' | 'employee' | 'project' = 'date';
	selectedEmployee: SelectedEmployee;
	dailyData: IAmountOwedReport[];

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	@Input()
	set filters(value) {
		this.logRequest = value || {};
		this.updateLogs$.next();
	}

	constructor(
		private timesheetService: TimesheetService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store,
		private cd: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getExpenses();
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: SelectedEmployee) => {
				if (employee && employee.id) {
					this.selectedEmployee = employee;
				} else {
					this.selectedEmployee = null;
				}
				this.updateLogs$.next();
			});

		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.futureDateAllowed = await this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				);
			});

		this.updateLogs$.next();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.updateLogs$.next();
	}

	groupByChange() {
		this.updateLogs$.next();
	}

	async getExpenses() {
		const { startDate, endDate } = this.logRequest;

		const appliedFilter = pick(this.logRequest, 'projectIds');

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null,
			groupBy: this.groupBy,
			...(this.selectedEmployee && this.selectedEmployee.id
				? { employeeIds: [this.selectedEmployee.id] }
				: {})
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

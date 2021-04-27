import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetPaymentInput,
	IGetTimeLogReportInput,
	IOrganization,
	IClientBudgetLimitReport,
	OrganizationContactBudgetTypeEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { toUTC } from '@gauzy/common-angular';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { pick } from 'underscore';

@UntilDestroy()
@Component({
	selector: 'ga-client-budgets-report',
	templateUrl: './client-budgets-report.component.html',
	styleUrls: ['./client-budgets-report.component.scss']
})
export class ClientBudgetsReportComponent implements OnInit, AfterViewInit {
	logRequest: IGetPaymentInput = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;
	OrganizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;

	loading: boolean;
	private _selectedDate: Date = new Date();
	groupBy: 'date' | 'employee' | 'client' | 'client' = 'date';
	filters: IGetPaymentInput;

	clients: IClientBudgetLimitReport[];

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	constructor(
		private timesheetService: TimesheetService,
		private store: Store,
		private cd: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(
				debounceTime(1350),
				tap(() => this.getReportData()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					if (organization) {
						this.organization = organization;
						if (employee && employee.id) {
							this.logRequest.employeeIds = [employee.id];
						} else {
							delete this.logRequest.employeeIds;
						}
						if (project && project.id) {
							this.logRequest.projectIds = [project.id];
						} else {
							delete this.logRequest.projectIds;
						}
						this.updateLogs$.next();
					}
				}),
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
		this.updateLogs$.next();
	}

	async getReportData() {
		const { startDate, endDate } = this.logRequest;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const appliedFilter = pick(
			this.logRequest,
			'clientIds',
			'projectIds',
			'employeeIds'
		);

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			organizationId,
			tenantId,
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getClientBudgetLimit(request)
			.then((logs: IClientBudgetLimitReport[]) => {
				this.clients = logs;
			})
			.catch(() => {})
			.finally(() => (this.loading = false));
	}
}

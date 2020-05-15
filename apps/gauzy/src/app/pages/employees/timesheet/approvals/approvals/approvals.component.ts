// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	IGetTimeLogInput,
	Organization,
	IDateRange,
	PermissionsEnum,
	TimesheetStatus,
	Timesheet
} from '@gauzy/models';
import { toUTC } from 'libs/utils';
import {
	NbCheckboxComponent,
	NbDialogRef,
	NbMenuService
} from '@nebular/theme';
import * as moment from 'moment';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { filter, map, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Router } from '@angular/router';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';

@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent implements OnInit, OnDestroy {
	timeSheets: Timesheet[];
	today: Date = new Date();
	checkboxAll = false;
	selectedIds: any = {};
	private _selectedDate: Date;
	@ViewChild('checkAllCheckbox', { static: false })
	checkAllCheckbox: NbCheckboxComponent;
	organization: Organization;
	addEditTimeRequest: any = {
		isBillable: true,
		projectId: null,
		taskId: null,
		description: ''
	};
	selectedRange: IDateRange = { start: null, end: null };
	showBulkAction = false;
	TimesheetStatus = TimesheetStatus;
	bulkActionOptions = [
		{
			title: 'Approve'
		},
		{
			title: 'Deny'
		}
	];
	dialogRef: NbDialogRef<any>;
	canChangeSelectedEmployee: boolean;
	logRequest: {
		startDate?: Date;
		endDate?: Date;
		employeeId?: string;
	} = {};

	updateLogs$: Subject<any> = new Subject();

	constructor(
		private timesheetService: TimesheetService,
		private store: Store,
		private router: Router,
		private toastrService: ToastrService,
		private nbMenuService: NbMenuService
	) {
		this.selectedDate = new Date();
	}

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
		this.logRequest.startDate = moment(value)
			.startOf('month')
			.toDate();
		this.logRequest.endDate = moment(value)
			.endOf('month')
			.toDate();
		this.updateLogs$.next();
	}
	async ngOnInit() {
		this.nbMenuService
			.onItemClick()
			.pipe(
				untilDestroyed(this),
				filter(({ tag }) => tag === 'timesheet-bulk-acton'),
				map(({ item: { title } }) => title)
			)
			.subscribe((title) => this.bulkAction(title));

		this.store.user$.pipe(untilDestroyed(this)).subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
				this.updateLogs$.next();
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: SelectedEmployee) => {
				if (employee) {
					this.logRequest.employeeId = employee.id;
					this.updateLogs$.next();
				}
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getTimeSheets();
			});

		this.updateLogs$.next();
	}

	async nextDay() {
		const date = moment(this.selectedDate).add(1, 'month');
		if (date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	async previousDay() {
		this.selectedDate = moment(this.selectedDate)
			.subtract(1, 'month')
			.toDate();
	}

	async getTimeSheets() {
		const { startDate, endDate, employeeId } = this.logRequest;
		const _startDate = moment(startDate).format('YYYY-MM-DD') + ' 00:00:00';
		const _endDate = moment(endDate).format('YYYY-MM-DD') + ' 23:59:59';

		const request: IGetTimeLogInput = {
			startDate: toUTC(_startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(_endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			organizationId: this.organization ? this.organization.id : null
		};
		this.timeSheets = await this.timesheetService
			.getTimeSheets(request)
			.then((logs) => {
				this.selectedIds = {};
				if (this.checkAllCheckbox) {
					this.checkAllCheckbox.checked = false;
					this.checkAllCheckbox.indeterminate = false;
				}
				logs.forEach((log) => (this.selectedIds[log.id] = false));
				return logs;
			});
	}

	toggleCheckbox(event: any, type?: any) {
		if (type === 'all') {
			for (const key in this.selectedIds) {
				if (this.selectedIds.hasOwnProperty(key)) {
					this.selectedIds[key] = event.target.checked;
				}
			}
		} else {
			let all_checked = true;
			let any_checked = false;
			for (const key in this.selectedIds) {
				if (this.selectedIds.hasOwnProperty(key)) {
					const is_checked = this.selectedIds[key];
					if (is_checked === false || is_checked === undefined) {
						all_checked = false;
					} else {
						any_checked = true;
					}
				}
			}

			if (all_checked) {
				this.showBulkAction = true;
				this.checkAllCheckbox.indeterminate = false;
				this.checkAllCheckbox.checked = true;
			} else if (any_checked) {
				this.showBulkAction = true;
				this.checkAllCheckbox.indeterminate = any_checked;
			} else {
				this.showBulkAction = false;
				this.checkAllCheckbox.checked = false;
				this.checkAllCheckbox.indeterminate = false;
			}
		}
	}

	updateStatus(timesheetId: string | string[], status: TimesheetStatus) {
		this.timesheetService.updateStatus(timesheetId, status).then(() => {
			if (status === TimesheetStatus.APPROVED) {
				this.toastrService.success('TIMESHEET.APPROVE_SUCCESS');
			} else if (status === TimesheetStatus.DENIED) {
				this.toastrService.success('TIMESHEET.DENIED_SUCCESS');
			}
			this.updateLogs$.next();
		});
	}

	submitTimeheet(
		timesheetId: string | string[],
		status: 'submit' | 'unsubmit'
	) {
		this.timesheetService.submitTimeheet(timesheetId, status).then(() => {
			if (status === 'submit') {
				this.toastrService.success('TIMESHEET.SUBMIT_SUCCESS');
			} else if (status === 'unsubmit') {
				this.toastrService.success('TIMESHEET.UNSUBMIT_SUCCESS');
			}
			this.updateLogs$.next();
		});
	}

	bulkAction(action) {
		const timeSheetIds = [];
		for (const key in this.selectedIds) {
			if (this.selectedIds.hasOwnProperty(key)) {
				const is_checked = this.selectedIds[key];
				if (is_checked) {
					timeSheetIds.push(key);
				}
			}
		}

		if (action === 'Approve') {
			this.updateStatus(timeSheetIds, TimesheetStatus.APPROVED);
		}
		if (action === 'Deny') {
			this.updateStatus(timeSheetIds, TimesheetStatus.DENIED);
		}
	}

	redirectToView(timesheet: Timesheet) {
		this.router.navigate(['/pages/employees/timesheets/', timesheet.id]);
	}

	ngOnDestroy() {}
}

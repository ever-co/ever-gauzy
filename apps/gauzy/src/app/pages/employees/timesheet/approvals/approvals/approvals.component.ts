import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IDateRange,
	IOrganization,
	ITimeLogFilters,
	ITimesheet,
	TimesheetStatus,
	IGetTimesheetInput,
	ISelectedEmployee
} from '@gauzy/contracts';
import { toUTC } from '@gauzy/common-angular';
import {
	NbCheckboxComponent,
	NbDialogRef,
	NbMenuService
} from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { debounceTime, filter, map, tap, withLatestFrom } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Router } from '@angular/router';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent implements OnInit, OnDestroy {
	timeSheets: ITimesheet[];
	today: Date = new Date();
	checkboxAll = false;
	selectedIds: any = {};
	@ViewChild('checkAllCheckbox')
	checkAllCheckbox: NbCheckboxComponent;
	organization: IOrganization;
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
	logRequest: ITimeLogFilters = {};

	updateLogs$: Subject<any> = new Subject();
	loading: boolean;

	selectedEmployeeId = null;

	constructor(
		private timesheetService: TimesheetService,
		private store: Store,
		private router: Router,
		private toastrService: ToastrService,
		private timesheetFilterService: TimesheetFilterService,
		private nbMenuService: NbMenuService
	) {}

	async ngOnInit() {
		this.nbMenuService
			.onItemClick()
			.pipe(
				untilDestroyed(this),
				filter(({ tag }) => tag === 'timesheet-bulk-acton'),
				map(({ item: { title } }) => title)
			)
			.subscribe((title) => this.bulkAction(title));

		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.organization) {
					this.selectedEmployeeId = employee.id;
					this.updateLogs$.next();
				}
			});
		storeOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				this.selectedEmployeeId = employee ? employee.id : null;
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});
		this.updateLogs$
			.pipe(
				debounceTime(500),
				tap(() => this.getTimeSheets()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getTimeSheets() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = this.logRequest;

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const request: IGetTimesheetInput = {
			organizationId,
			tenantId,
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
		};

		this.loading = true;
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
			})
			.finally(() => (this.loading = false));
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

	submitTimesheet(
		timesheetId: string | string[],
		status: 'submit' | 'unsubmit'
	) {
		this.timesheetService.submitTimesheet(timesheetId, status).then(() => {
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

	redirectToView(timesheet: ITimesheet) {
		this.router.navigate(['/pages/employees/timesheets/', timesheet.id]);
	}

	ngOnDestroy(): void {}
}

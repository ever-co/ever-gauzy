import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IDateRange,
	IOrganization,
	ITimeLogFilters,
	ITimesheet,
	TimesheetStatus,
	IGetTimesheetInput
} from '@gauzy/models';
import { toUTC } from 'libs/utils';
import {
	NbCheckboxComponent,
	NbDialogRef,
	NbMenuService
} from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { debounceTime, filter, map } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Router } from '@angular/router';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';

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

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getTimeSheets();
			});
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getTimeSheets() {
		if (!this.organization) {
			return;
		}
		const { startDate, endDate } = this.logRequest;
		const request: IGetTimesheetInput = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId,
			...this.logRequest,
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

	redirectToView(timesheet: ITimesheet) {
		this.router.navigate(['/pages/employees/timesheets/', timesheet.id]);
	}

	ngOnDestroy(): void {}
}

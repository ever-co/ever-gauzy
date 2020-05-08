// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
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
import { takeUntil, filter, map, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';

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
	private _selectedDate: Date = new Date();
	private _ngDestroy$ = new Subject<void>();
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
	bulkActionOptions = [
		{
			title: 'Approve'
		},
		{
			title: 'Denied'
		}
	];
	dialogRef: NbDialogRef<any>;
	canChangeSelectedEmployee: boolean;
	logRequest: {
		date?: Date;
		employeeId?: string;
	} = {};

	updateLogs$: Subject<any> = new Subject();

	constructor(
		private timeTrackerService: TimeTrackerService,
		private store: Store,
		private toastrService: ToastrService,
		private nbMenuService: NbMenuService
	) {}

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
		this.logRequest.date = value;
		this.updateLogs$.next();
	}
	async ngOnInit() {
		this.nbMenuService
			.onItemClick()
			.pipe(
				takeUntil(this._ngDestroy$),
				filter(({ tag }) => tag === 'timesheet-bulk-acton'),
				map(({ item: { title } }) => title)
			)
			.subscribe((title) => this.bulkAction(title));

		this.store.user$.subscribe(() => {
			this.canChangeSelectedEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee: SelectedEmployee) => {
				if (employee) {
					this.logRequest.employeeId = employee.id;
					this.updateLogs$.next();
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization: Organization) => {
				this.organization = organization;
			});

		this.updateLogs$
			.pipe(takeUntil(this._ngDestroy$), debounceTime(500))
			.subscribe(() => {
				this.getTimeSheets();
			});
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
		const { date, employeeId } = this.logRequest;
		const startDate = moment(date).format('YYYY-MM-DD') + ' 00:00:00';
		const endDate = moment(date).format('YYYY-MM-DD') + ' 23:59:59';

		const request: IGetTimeLogInput = {
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			organizationId: this.organization ? this.organization.id : null
		};
		this.timeSheets = await this.timeTrackerService
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
		this.timeTrackerService
			.updateStatus(timesheetId, status)
			.then((data) => {
				this.toastrService.success(data);
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
		if (action === 'Denied') {
			this.updateStatus(timeSheetIds, TimesheetStatus.DENIED);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

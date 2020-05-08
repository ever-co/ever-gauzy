// tslint:disable: nx-enforce-module-boundaries
import {
	Component,
	OnInit,
	ViewChild,
	TemplateRef,
	OnDestroy
} from '@angular/core';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import {
	IGetTimeLogInput,
	TimeLog,
	Organization,
	IDateRange,
	PermissionsEnum
} from '@gauzy/models';
import { toUTC, toLocal } from 'libs/utils';
import {
	NbCheckboxComponent,
	NbDialogService,
	NbDialogRef,
	NbMenuService
} from '@nebular/theme';
import * as moment from 'moment';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { NgForm } from '@angular/forms';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { takeUntil, filter, map, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-daily',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent implements OnInit, OnDestroy {
	timeLogs: TimeLog[];
	today: Date = new Date();
	checkboxAll = false;
	selectedIds: any = {};
	timesheetRequest: {
		startDate?: Date;
		endDate?: Date;
		employeeId?: string;
	} = {};

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
			title: 'Delete'
		}
	];
	dialogRef: NbDialogRef<any>;
	canChangeSelectedEmployee: boolean;
	logRequest: {
		date?: Date;
		employeeId?: string;
	} = {};

	updateLogs$: Subject<any> = new Subject();

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
		this.timesheetRequest.startDate = moment(value)
			.startOf('isoWeek')
			.toDate();
		this.timesheetRequest.endDate = moment(value)
			.endOf('isoWeek')
			.toDate();
		this.updateLogs$.next();
	}

	constructor(
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private store: Store,
		private nbMenuService: NbMenuService
	) {}

	async ngOnInit() {
		this.nbMenuService
			.onItemClick()
			.pipe(
				takeUntil(this._ngDestroy$),
				filter(({ tag }) => tag === 'time-logs-bulk-acton'),
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
				this.getLogs();
			});
	}

	async nextDay() {
		const date = moment(this.selectedDate).add(1, 'day');
		if (date.isAfter(this.today)) {
			return;
		}
		this.selectedDate = date.toDate();
	}

	async previousDay() {
		this.selectedDate = moment(this.selectedDate)
			.subtract(1, 'day')
			.toDate();
	}

	async getLogs() {
		const { date, employeeId } = this.logRequest;
		const startDate = moment(date).format('YYYY-MM-DD') + ' 00:00:00';
		const endDate = moment(date).format('YYYY-MM-DD') + ' 23:59:59';

		const request: IGetTimeLogInput = {
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			organizationId: this.organization ? this.organization.id : null
		};
		this.timeLogs = await this.timeTrackerService
			.getTimeLogs(request)
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

	addTime(f: NgForm) {
		if (!f.valid) {
			return;
		}
		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();

		const addRequestData = {
			startedAt,
			stoppedAt,
			isBillable: this.addEditTimeRequest.isBillable,
			projectId: this.addEditTimeRequest.projectId,
			taskId: this.addEditTimeRequest.taskId,
			description: this.addEditTimeRequest.description
		};

		(this.addEditTimeRequest.id
			? this.timeTrackerService.updateTime(
					this.addEditTimeRequest.id,
					addRequestData
			  )
			: this.timeTrackerService.addTime(addRequestData)
		)
			.then(() => {
				this.updateLogs$.next();
				f.resetForm();
				this.dialogRef.close();
				this.selectedRange = { start: null, end: null };
				this.toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
			})
			.catch((error) => {
				this.toastrService.danger(error);
			});
	}

	openEdit(dialog: TemplateRef<any>, timeLog: TimeLog) {
		this.addEditTimeRequest = Object.assign({}, timeLog);
		this.selectedRange = {
			start: toLocal(timeLog.startedAt).toDate(),
			end: toLocal(timeLog.stoppedAt).toDate()
		};
		this.dialogRef = this.dialogService.open(dialog, { context: timeLog });
	}

	onDeleteConfirm(log) {
		this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.subscribe((type) => {
				if (type === 'ok') {
					this.timeTrackerService.deleteLogs(log.id).then(() => {
						const index = this.timeLogs.indexOf(log);
						this.timeLogs.splice(index, 1);
					});
				}
			});
	}

	bulkAction(action) {
		if (action === 'Delete') {
			this.dialogService
				.open(DeleteConfirmationComponent)
				.onClose.subscribe((type) => {
					if (type === 'ok') {
						const logIds = [];
						for (const key in this.selectedIds) {
							if (this.selectedIds.hasOwnProperty(key)) {
								const is_checked = this.selectedIds[key];
								if (is_checked) {
									logIds.push(key);
								}
							}
						}
						this.timeTrackerService.deleteLogs(logIds).then(() => {
							this.updateLogs$.next();
						});
					}
				});
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

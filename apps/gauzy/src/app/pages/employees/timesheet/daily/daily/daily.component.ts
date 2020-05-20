// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
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
	NbMenuService
} from '@nebular/theme';
import * as moment from 'moment';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { takeUntil, filter, map, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { EditTimeLogModalComponent } from 'apps/gauzy/src/app/@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';
import { ActivatedRoute, Router } from '@angular/router';

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

	private _ngDestroy$ = new Subject<void>();
	@ViewChild('checkAllCheckbox')
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
	canChangeSelectedEmployee: boolean;
	logRequest: {
		date?: Date;
		employeeId?: string;
		organizationId?: string;
	} = {};

	updateLogs$: Subject<any> = new Subject();

	public get selectedDate(): Date {
		return this.logRequest.date;
	}
	public set selectedDate(value: Date) {
		this.logRequest.date = value;
		this.updateLogs$.next();
	}

	constructor(
		private timesheetService: TimesheetService,
		private dialogService: NbDialogService,
		private store: Store,
		private nbMenuService: NbMenuService,
		private activatedRoute: ActivatedRoute,
		private router: Router
	) {}

	async ngOnInit() {
		if (this.activatedRoute.snapshot.queryParams) {
			const query = this.activatedRoute.snapshot.queryParams;
			if (query.startDate) {
				this.logRequest.date = toLocal(query.startDate).toDate();
			} else {
				this.logRequest.date = this.today;
			}

			if (query.organizationId) {
				this.logRequest.organizationId = query.organizationId;
			}

			if (query.employeeId) {
				this.logRequest.employeeId = query.employeeId;
			}
		}

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

		this.updateLogs$.next();
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
		if (!this.organization) {
			return;
		}

		const { employeeId } = this.logRequest;
		const startDate = moment(this.logRequest.date).startOf('day');
		const endDate = moment(this.logRequest.date).endOf('day');

		const request: IGetTimeLogInput = {
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeId ? { employeeId } : {}),
			organizationId: this.organization.id
		};

		this.router.navigate([], {
			queryParams: request,
			queryParamsHandling: 'merge'
		});

		this.timeLogs = await this.timesheetService
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

	openAdd() {
		this.dialogService
			.open(EditTimeLogModalComponent)
			.onClose.subscribe(() => {
				this.updateLogs$.next();
			});
	}
	openEdit(timeLog: TimeLog) {
		this.dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.subscribe(() => {
				this.updateLogs$.next();
			});
	}

	onDeleteConfirm(log) {
		this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.subscribe((type) => {
				if (type === 'ok') {
					this.timesheetService.deleteLogs(log.id).then(() => {
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
						this.timesheetService.deleteLogs(logIds).then(() => {
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

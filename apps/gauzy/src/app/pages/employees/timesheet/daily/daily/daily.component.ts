// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	IGetTimeLogInput,
	ITimeLog,
	IOrganization,
	IDateRange,
	PermissionsEnum,
	ITimeLogFilters,
	OrganizationPermissionsEnum
} from '@gauzy/models';
import { toUTC } from '@gauzy/utils';
import {
	NbCheckboxComponent,
	NbDialogService,
	NbMenuService
} from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { filter, map, debounceTime, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { EditTimeLogModalComponent } from 'apps/gauzy/src/app/@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ViewTimeLogModalComponent } from 'apps/gauzy/src/app/@shared/timesheet/view-time-log-modal/view-time-log-modal/view-time-log-modal.component';
import { ConfirmComponent } from 'apps/gauzy/src/app/@shared/dialogs';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';
import * as _ from 'underscore';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-daily',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent implements OnInit, OnDestroy {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	timeLogs: ITimeLog[];
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
	bulkActionOptions = [
		{
			title: 'Delete'
		}
	];
	logRequest: ITimeLogFilters = {};

	updateLogs$: Subject<any> = new Subject();
	loading: boolean;

	constructor(
		private timesheetService: TimesheetService,
		private dialogService: NbDialogService,
		private store: Store,
		private nbMenuService: NbMenuService,
		private timesheetFilterService: TimesheetFilterService,
		private translateService: TranslateService
	) {}

	async ngOnInit() {
		this.nbMenuService
			.onItemClick()
			.pipe(
				untilDestroyed(this),
				filter(({ tag }) => tag === 'time-logs-bulk-acton'),
				map(({ item: { title } }) => title)
			)
			.subscribe((title) => this.bulkAction(title));
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
				}
			});
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async filtersChange($event: ITimeLogFilters) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization) {
			return;
		}
		if (!this.logRequest) {
			return;
		}

		const { employeeIds, startDate, endDate } = this.logRequest;
		const appliedFilter = _.pick(
			this.logRequest,
			'employeeIds',
			'projectIds',
			'source',
			'activityLevel',
			'logType'
		);

		const request: IGetTimeLogInput = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId,
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeIds ? { employeeIds } : {})
		};

		this.loading = true;
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

	openAdd() {
		this.dialogService
			.open(EditTimeLogModalComponent, {
				context: {
					timeLog: {
						startedAt: new Date(this.logRequest.startDate),
						employeeId: this.logRequest.employeeIds
							? this.logRequest.employeeIds[0]
							: null,
						projectId: this.logRequest.projectIds
							? this.logRequest.projectIds[0]
							: null
					}
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.updateLogs$.next();
				}
			});
	}
	openEdit(timeLog: ITimeLog) {
		this.dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.updateLogs$.next();
				}
			});
	}

	openView(timeLog: ITimeLog) {
		this.dialogService
			.open(ViewTimeLogModalComponent, {
				context: {
					timeLog
				},
				dialogClass: 'view-log-dialog'
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.updateLogs$.next();
				}
			});
	}

	onDeleteConfirm(log) {
		this.timesheetService.deleteLogs(log.id).then(() => {
			const index = this.timeLogs.indexOf(log);
			this.timeLogs.splice(index, 1);
		});
	}

	bulkAction(action) {
		if (action === 'Delete') {
			this.dialogService
				.open(ConfirmComponent, {
					context: {
						data: {
							message: this.translateService.instant(
								'TIMESHEET.DELETE_TIMELOG'
							)
						}
					}
				})
				.onClose.pipe(untilDestroyed(this))
				.subscribe((type) => {
					if (type === true) {
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

	ngOnDestroy(): void {}
}

// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	IGetTimeLogInput,
	ITimeLog,
	IOrganization,
	IDateRange,
	PermissionsEnum,
	ITimeLogFilters,
	OrganizationPermissionsEnum,
	ISelectedEmployee
} from '@gauzy/contracts';
import { toUTC } from '@gauzy/common-angular';
import {
	NbCheckboxComponent,
	NbDialogService,
	NbMenuService
} from '@nebular/theme';
import { Store } from './../../../../../@core/services/store.service';
import { filter, map, debounceTime, tap, withLatestFrom } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { TimesheetService } from './../../../../../@shared/timesheet/timesheet.service';
import { EditTimeLogModalComponent } from './../../../../../@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ViewTimeLogModalComponent } from './../../../../../@shared/timesheet/view-time-log-modal/view-time-log-modal/view-time-log-modal.component';
import { ConfirmComponent } from './../../../../../@shared/dialogs';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';
import * as _ from 'underscore';
import { ActivatedRoute } from '@angular/router';

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

	selectedEmployeeId = null;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly nbMenuService: NbMenuService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly translateService: TranslateService,
		private readonly route: ActivatedRoute
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
				untilDestroyed(this),
				debounceTime(500),
				tap(() => this.getLogs())
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params),
				debounceTime(1000),
				untilDestroyed(this)
			)
			.subscribe((params) => {
				if (params.get('openAddDialog') === 'true') {
					this.openAdd();
				}
			});
	}

	async filtersChange($event: ITimeLogFilters) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = this.logRequest;

		const appliedFilter = _.pick(
			this.logRequest,
			'projectIds',
			'source',
			'activityLevel',
			'logType'
		);

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const request: IGetTimeLogInput = {
			organizationId,
			tenantId,
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeIds.length > 0 ? { employeeIds } : {})
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

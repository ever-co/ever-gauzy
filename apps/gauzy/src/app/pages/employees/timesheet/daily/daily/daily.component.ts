// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { isEmpty } from '@gauzy/common-angular';
import {
	NbDialogService,
	NbMenuItem,
	NbMenuService
} from '@nebular/theme';
import { filter, map, debounceTime, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'underscore';
import {
	IGetTimeLogInput,
	ITimeLog,
	PermissionsEnum,
	ITimeLogFilters,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from './../../../../../@core/services';
import { TimesheetService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { EditTimeLogModalComponent, ViewTimeLogModalComponent } from './../../../../../@shared/timesheet';
import { ConfirmComponent } from './../../../../../@shared/dialogs';
import { TimeTrackerService } from './../../../../../@shared/time-tracker/time-tracker.service';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-daily-timesheet',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent  extends BaseSelectorFilterComponent 
	implements AfterViewInit, OnInit, OnDestroy {
	
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;

	loading: boolean;
	showBulkAction: boolean;
	
	logRequest: ITimeLogFilters = this.request;
	timeLogs: ITimeLog[] = [];

	allChecked: boolean;
	contextMenus: NbMenuItem[];

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly dialogService: NbDialogService,
		protected readonly store: Store,
		private readonly nbMenuService: NbMenuService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly toastrService: ToastrService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this._applyTranslationOnChange();
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getLogs()),
				tap(() => this.allChecked = false),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbMenuService
			.onItemClick()
			.pipe(
				untilDestroyed(this),
				filter(({ tag }) => tag === 'time-logs-bulk-action'),
				map(({ item: { data } }) => data.action),
				filter((action) => action === 'DELETE'),
				tap(() => this._bulkDeleteAction())
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				debounceTime(1000),
				filter((params) => !!params),
				filter((params) => params.get('openAddDialog') === 'true'),
				tap(() => this.openAdd()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._createContextMenus();
	}

	async filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.timesheetFilterService.filter = filters;
		this.subject$.next(true);
	}

	async getLogs() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		this.loading = true;
		const appliedFilter = _.pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
		};
		try {
			this.timeLogs = await this.timesheetService
				.getTimeLogs(request)
				.then((logs: ITimeLog[]) => {
					return logs;
				})
				.finally(() => (this.loading = false));
		} catch (error) {
			console.log('Error while retriving daily time logs entries', error);
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
					this.subject$.next(true);
				}
			});
	}
	openEdit(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		this.dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.subject$.next(true);
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
					this.subject$.next(true);
				}
			});
	}

	onDeleteConfirm(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		try {
			const employee = timeLog.employee;
			const { id: organizationId } = this.organization;
			const request = {
				logIds: [timeLog.id],
				organizationId
			}
			this.timesheetService.deleteLogs(request).then(() => {
				this.checkTimerStatus();
				this.toastrService.success('TOASTR.MESSAGE.TIME_LOG_DELETED', {
					name: employee.fullName,
					organization: this.organization.name
				});
			}).finally(() => {
				this.subject$.next(true);
			});
		} catch (error) {
			console.log('Error while delete TimeLog: ', error);
			this.toastrService.danger(error);
		}
	}

	private _bulkDeleteAction() {
		this.dialogService
			.open(ConfirmComponent, {
				context: {
					data: {
						message: this.translateService.instant('TIMESHEET.DELETE_TIMELOG')
					}
				}
			})
			.onClose
			.pipe(
				filter(Boolean),
				untilDestroyed(this)
			)
			.subscribe((type) => {
				if (type === true) {
					const logIds = this.timeLogs.filter(
						(timeLog: ITimeLog) => timeLog['checked'] && !timeLog['isRunning']
					).map(
						(timeLog: ITimeLog) => timeLog.id
					);
					const { id: organizationId } = this.organization;
					const request = {
						logIds,
						organizationId
					}
					this.timesheetService.deleteLogs(request).then(() => {
						this.checkTimerStatus();
						this.toastrService.success('TOASTR.MESSAGE.TIME_LOGS_DELETED', {
							organization: this.organization.name
						});
					})
					.finally(() => {
						this.subject$.next(true);
					});
				}
			});
	}

	private checkTimerStatus() {
		const { employee, tenantId } = this.store.user;
		if (employee && employee.id) {
			this.timeTrackerService.checkTimerStatus(tenantId);
		}
	}

	/**
	 * Checked/Un-Checked Checkbox
	 * 
	 * @param checked 
	 */
	 public checkedAll(checked: boolean) {
		this.allChecked = checked;
		this.timeLogs.filter((timeLog: ITimeLog) => !timeLog.isRunning).forEach((timesheet: any) => timesheet.checked = checked);
	}

	/**
	 * Is Indeterminate
	 * 
	 * @returns 
	 */
	public isIndeterminate() {
		const c1 = (this.timeLogs.filter((t: any) => t.checked).length > 0);
		return c1 && !this.allChecked;
	}

	/**
	 * Checkbox Toggle For Every TimeLog
	 * 
	 * @param checked 
	 * @param timesheet 
	 */
	public toggleCheckbox(checked: boolean, timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		timeLog['checked'] = checked;
		this.allChecked = this.timeLogs.every((t: any) => t.checked);
	}

	/**
	 * Translate context menus
	 */
	private _applyTranslationOnChange() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._createContextMenus()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create bulk action context menus
	 */
	private _createContextMenus() {
		this.contextMenus = [
			{
				title: this.getTranslation('TIMESHEET.DELETE'),
				data: {
					action: 'DELETE'
				}
			}
		];
	}

	ngOnDestroy(): void {}
}

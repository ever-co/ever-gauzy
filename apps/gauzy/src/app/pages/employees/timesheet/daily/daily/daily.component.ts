// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import {
	NbDialogService,
	NbMenuItem,
	NbMenuService
} from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { filter, map, debounceTime, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'underscore';
import {
	IGetTimeLogInput,
	ITimeLog,
	IOrganization,
	PermissionsEnum,
	ITimeLogFilters,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { Store } from './../../../../../@core/services';
import { TimesheetService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { EditTimeLogModalComponent, ViewTimeLogModalComponent } from './../../../../../@shared/timesheet';
import { ConfirmComponent } from './../../../../../@shared/dialogs';
import { TimeTrackerService } from './../../../../../@shared/time-tracker/time-tracker.service';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-daily',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent 
	extends TranslationBaseComponent 
	implements AfterViewInit, OnInit, OnDestroy {
	
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;

	loading: boolean;
	showBulkAction: boolean;
	
	logRequest: ITimeLogFilters;
	timeLogs: ITimeLog[] = [];

	logs$: Subject<any> = new Subject();
	public organization: IOrganization;
	selectedEmployeeId: string | null = null;
	projectId: string | null = null;

	allChecked: boolean;
	contextMenus: NbMenuItem[];

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly nbMenuService: NbMenuService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnChange();
		this.logs$
			.pipe(
				debounceTime(500),
				tap(() => this.loading = true),
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

		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.logs$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async filtersChange($event: ITimeLogFilters) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
		this.logs$.next();
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
			'source',
			'activityLevel',
			'logType'
		);

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const projectIds: string[] = [];
		if (this.projectId) {
			projectIds.push(this.projectId);
		}

		const request: IGetTimeLogInput = {
			organizationId,
			tenantId,
			...appliedFilter,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			...(projectIds.length > 0 ? { projectIds } : {})
		};

		this.timeLogs = await this.timesheetService
			.getTimeLogs(request)
			.then((logs: ITimeLog[]) => {
				return logs;
			})
			.finally(() => (this.loading = false));
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
					this.logs$.next();
				}
			});
	}
	openEdit(timeLog: ITimeLog) {
		this.dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.logs$.next();
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
					this.logs$.next();
				}
			});
	}

	onDeleteConfirm(timeLog: ITimeLog) {
		this.timesheetService.deleteLogs(timeLog.id)
			.then(() => {
				this.checkTimerStatus();
			})
			.finally(() => {
				this.logs$.next();
			});
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
			.pipe(untilDestroyed(this))
			.subscribe((type) => {
				if (type === true) {
					const logIds = this.timeLogs.filter(
						(timelog: ITimeLog) => timelog['checked']
					).map(
						(timelog: ITimeLog) => timelog.id
					);
					this.timesheetService.deleteLogs(logIds)
						.then(() => {
							this.checkTimerStatus();
						})
						.finally(() => {
							this.logs$.next();
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
		this.timeLogs.forEach((timesheet: any) => timesheet.checked = checked);
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
	public toggleCheckbox(checked: boolean, timelog: ITimeLog) {
		timelog['checked'] = checked;
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

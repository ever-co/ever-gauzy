// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { isEmpty } from '@gauzy/common-angular';
import {
	NbDialogService,
	NbMenuItem,
	NbMenuService
} from '@nebular/theme';
import { filter, map, debounceTime, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pick } from 'underscore';
import {
	IGetTimeLogInput,
	ITimeLog,
	PermissionsEnum,
	ITimeLogFilters
} from '@gauzy/contracts';
import { DateRangePickerBuilderService, Store, ToastrService } from './../../../../../@core/services';
import { TimesheetService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { EditTimeLogModalComponent, ViewTimeLogModalComponent } from './../../../../../@shared/timesheet';
import { ConfirmComponent } from './../../../../../@shared/dialogs';
import { TimeTrackerService } from './../../../../../@shared/time-tracker/time-tracker.service';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-daily-timesheet',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent extends BaseSelectorFilterComponent implements 
	AfterViewInit, OnInit, OnDestroy {

	PermissionsEnum = PermissionsEnum;
	loading: boolean = false;
	disableButton: boolean = true;
	allChecked: boolean = false;
	filters: ITimeLogFilters = this.request;
	timeLogs: ITimeLog[] = [];
	contextMenus: NbMenuItem[] = [];

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent; 
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	selectedLog: {
		data: ITimeLog,
		isSelected: boolean
	};

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly dialogService: NbDialogService,
		protected readonly store: Store,
		private readonly nbMenuService: NbMenuService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly toastrService: ToastrService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this._applyTranslationOnChange();
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this._clearItem()),
				tap(() => this.prepareRequest()),
				tap(() => (this.allChecked = false)),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				debounceTime(400),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.subject$.next(true)),
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
				filter((params: ParamMap) => !!params),
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				tap(() => this.openAdd()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._createContextMenus();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Prepare Unique Request Always
	 * 
	 * @returns 
	 */
	prepareRequest() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
		};
		this.payloads$.next(request);
	}

	async getLogs() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const payloads = this.payloads$.getValue();

		this.loading = true;
		try {
			this.timeLogs = await this.timesheetService.getTimeLogs(payloads);
		} catch (error) {
			console.log('Error while retriving daily time logs entries', error);
			this.toastrService.error(error);
		} finally {
			this.loading = false;
		}
	}

	openAdd() {
		this.dialogService
			.open(EditTimeLogModalComponent, {
				context: {
					timeLog: {
						startedAt: new Date(this.request.startDate),
						employeeId: this.request.employeeIds
							? this.request.employeeIds[0]
							: null,
						projectId: this.request.projectIds
							? this.request.projectIds[0]
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
			};
			this.timesheetService
				.deleteLogs(request)
				.then(() => {
					this.checkTimerStatus();
					this.toastrService.success(
						'TOASTR.MESSAGE.TIME_LOG_DELETED',
						{
							name: employee.fullName,
							organization: this.organization.name
						}
					);
				})
				.finally(() => {
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
						message: this.translateService.instant(
							'TIMESHEET.DELETE_TIMELOG'
						)
					}
				}
			})
			.onClose.pipe(filter(Boolean), untilDestroyed(this))
			.subscribe((type) => {
				if (type === true) {
					const logIds = this.timeLogs
						.filter(
							(timeLog: ITimeLog) =>
								timeLog['checked'] && !timeLog['isRunning']
						)
						.map((timeLog: ITimeLog) => timeLog.id);
					const { id: organizationId } = this.organization;
					const request = {
						logIds,
						organizationId
					};
					this.timesheetService
						.deleteLogs(request)
						.then(() => {
							this.checkTimerStatus();
							this.toastrService.success(
								'TOASTR.MESSAGE.TIME_LOGS_DELETED',
								{
									organization: this.organization.name
								}
							);
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
		this.timeLogs
			.filter((timeLog: ITimeLog) => !timeLog.isRunning)
			.forEach((timesheet: any) => (timesheet.checked = checked));
	}

	/**
	 * Is Indeterminate
	 *
	 * @returns
	 */
	public isIndeterminate() {
		const c1 = this.timeLogs.filter((t: any) => t.checked).length > 0;
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

	selectTimeLog({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedLog = {
			isSelected: isSelected,
			data: isSelected ? data : null
		}
	}

	/*
	 * Clear selected item
	 */
	private _clearItem() {
		this.selectTimeLog({
			isSelected: false,
			data: null
		});
	}

	/**
	 * User Select Single Row
	 * 
	 * @param timeLog 
	 */
	userRowSelect(timeLog: ITimeLog) {
		// if row is already selected, deselect it.
		if (timeLog.isSelected) {
			timeLog.isSelected = false;
			this.selectTimeLog({
				isSelected: timeLog.isSelected,
				data: null
			});
		} else {
			// find the row which was previously selected.
			const isRowSelected = this.timeLogs.find((item) => item.isSelected === true);
			if (!!isRowSelected) {
				// if row found successfully, mark that row as deselected
				isRowSelected.isSelected = false;
			}
			// mark new row as selected
			timeLog.isSelected = true;
			this.selectTimeLog({
				isSelected: timeLog.isSelected,
				data: timeLog
			});
		}
	}

	isRowSelected() {
		return !!this.timeLogs.find((t: ITimeLog) => t.isSelected);	
	}

	isCheckboxSelected() {
		return this.timeLogs.find((t: ITimeLog) => t.checked);
	}

	ngOnDestroy(): void {}
}

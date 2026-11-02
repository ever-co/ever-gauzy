import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import {
	ISubmitTimesheetInput,
	ITimesheet,
	IUpdateTimesheetStatusInput,
	PermissionsEnum,
	TimesheetStatus
} from '@gauzy/contracts';
import { NbMenuItem, NbMenuService } from '@nebular/theme';
import { debounceTime, distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { isEmpty } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetService, ToastrService } from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';

/** One choice of the status filter above the list, with how many timesheets it holds. */
interface IStatusFilterOption {
	status: TimesheetStatus | null;
	count: number;
}

/** The order the statuses are offered in: the ones waiting on a decision first. */
const STATUS_ORDER: TimesheetStatus[] = [
	TimesheetStatus.PENDING,
	TimesheetStatus.IN_REVIEW,
	TimesheetStatus.APPROVED,
	TimesheetStatus.DENIED,
	TimesheetStatus.DRAFT
];

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-timesheet-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ApprovalsComponent extends BaseSelectorFilterComponent implements AfterViewInit, OnInit, OnDestroy {
	timesheets: ITimesheet[] = [];
	contextMenus: NbMenuItem[] = [];

	loading: boolean = false;
	allChecked: boolean = false;
	/** True while a status change or a submit is being saved. */
	saving: boolean = false;

	/** The status the list is narrowed to; null shows every timesheet. */
	statusFilter: TimesheetStatus | null = null;
	/** All, then each status that has timesheets in the period. */
	statusOptions: IStatusFilterOption[] = [];

	/** The employee is read, and its column shown, only for users who may see other employees. */
	showEmployee: boolean = false;

	/** Numbers each read of the timesheets, so only the latest one's answer is shown. */
	private _fetchId = 0;

	TimesheetStatus = TimesheetStatus;
	PermissionsEnum = PermissionsEnum;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly nbMenuService: NbMenuService,
		public readonly translateService: TranslateService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this._applyEmployeePermission();
		this._applyTranslationOnChange();
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getTimeSheets()),
				tap(() => (this.allChecked = false)),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbMenuService
			.onItemClick()
			.pipe(
				untilDestroyed(this),
				filter(({ tag }) => tag === 'timesheet-bulk-action'),
				map(({ item: { data } }) => data.status),
				tap((status) => this.bulkAction(status))
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._createContextMenus();
	}

	/** The timesheets the status filter lets through. */
	get visibleTimesheets(): ITimesheet[] {
		return this.statusFilter
			? this.timesheets.filter((timesheet: ITimesheet) => timesheet.status === this.statusFilter)
			: this.timesheets;
	}

	/** Time logged across the timesheets in view, in seconds. */
	get visibleDuration(): number {
		return this.visibleTimesheets.reduce((total: number, timesheet: ITimesheet) => total + (timesheet.duration || 0), 0);
	}

	/**
	 * Reads the timesheets of the period. A read still in flight when a newer
	 * one starts (the permissions landing mid-read, say) is dropped when it
	 * answers, so an answer fetched without the employee cannot replace one
	 * fetched with it.
	 */
	async getTimeSheets() {
		if (!this.organization) {
			return;
		}
		const fetchId = ++this._fetchId;
		this.loading = true;
		try {
			const timesheets = await this.timesheetService.getTimeSheets({
				...this.getFilterRequest(this.request),
				relations: [...(this.showEmployee ? ['employee', 'employee.user'] : [])]
			});
			if (fetchId === this._fetchId) {
				this.timesheets = timesheets;
			}
		} catch (error) {
			console.log('Error while getting timesheets for selected date range');
		} finally {
			if (fetchId === this._fetchId) {
				this._buildStatusOptions();
				this.loading = false;
			}
		}
	}

	/**
	 * Narrows the list to one status, or shows every timesheet again. Checked
	 * rows are cleared, so a bulk action never reaches a row out of view.
	 *
	 * @param status The status to show, or null for all of them
	 */
	setStatusFilter(status: TimesheetStatus | null) {
		this.statusFilter = status;
		this.checkedAll(false);
	}

	/**
	 * Update timesheets status
	 *
	 * @param timesheetIds
	 * @param status
	 * @returns
	 */
	updateStatus(timesheetIds: string | string[], status: TimesheetStatus) {
		if (!this.organization || isEmpty(timesheetIds) || this.saving) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const request: IUpdateTimesheetStatusInput = {
			ids: this.prepareTimesheetIds(timesheetIds),
			status,
			organizationId,
			tenantId
		};
		this.saving = true;
		this.timesheetService
			.updateStatus(request)
			.then(() => {
				if (status === TimesheetStatus.APPROVED) {
					this.toastrService.success('TIMESHEET.APPROVE_SUCCESS');
				} else if (status === TimesheetStatus.DENIED) {
					this.toastrService.success('TIMESHEET.DENIED_SUCCESS');
				}
			})
			.finally(() => {
				this.saving = false;
				this.subject$.next(true);
			});
	}

	submitTimesheet(timesheetIds: string | string[], status: 'submit' | 'unsubmit') {
		if (!this.organization || isEmpty(timesheetIds) || this.saving) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const request: ISubmitTimesheetInput = {
			ids: this.prepareTimesheetIds(timesheetIds),
			status,
			organizationId,
			tenantId
		};
		this.saving = true;
		this.timesheetService
			.submitTimesheet(request)
			.then(() => {
				if (status === 'submit') {
					this.toastrService.success('TIMESHEET.SUBMIT_SUCCESS');
				} else if (status === 'unsubmit') {
					this.toastrService.success('TIMESHEET.UNSUBMIT_SUCCESS');
				}
			})
			.finally(() => {
				this.saving = false;
				this.subject$.next(true);
			});
	}

	/**
	 * Bulk action for APPROVED/DENIED timesheet
	 *
	 * @param status
	 */
	bulkAction(status: TimesheetStatus) {
		const timeSheetIds = this.visibleTimesheets
			.filter((timesheet: ITimesheet) => timesheet['checked'])
			.map((timesheet: ITimesheet) => timesheet.id);
		if (status === TimesheetStatus.APPROVED) {
			this.updateStatus(timeSheetIds, TimesheetStatus.APPROVED);
		}
		if (status === TimesheetStatus.DENIED) {
			this.updateStatus(timeSheetIds, TimesheetStatus.DENIED);
		}
	}

	/**
	 * Redirect to timesheet inner page
	 *
	 * @param timesheet
	 * @returns
	 */
	redirectToView(timesheet: ITimesheet) {
		if (!timesheet) {
			return;
		}
		this.router.navigate(['/pages/employees/timesheets', timesheet.id]);
	}

	/**
	 * Checked/Un-Checked Checkbox
	 *
	 * @param checked
	 */
	checkedAll(checked: boolean) {
		this.allChecked = checked;
		this.timesheets.forEach((timesheet: any) => (timesheet.checked = false));
		this.visibleTimesheets.forEach((timesheet: any) => (timesheet.checked = checked));
	}

	/**
	 * Is Indeterminate
	 *
	 * @returns
	 */
	isIndeterminate() {
		const c1 = this.visibleTimesheets.filter((t: any) => t.checked).length > 0;
		return c1 && !this.allChecked;
	}

	/**
	 * Checkbox Toggle For Every Timesheet
	 *
	 * @param checked
	 * @param timesheet
	 */
	toggleCheckbox(checked: boolean, timesheet: ITimesheet) {
		timesheet['checked'] = checked;
		this.allChecked = this.visibleTimesheets.length > 0 && this.visibleTimesheets.every((t: any) => t.checked);
	}

	/**
	 * Shows the Employee column, and reads the employee with the timesheets, as
	 * soon as the user may see other employees. The permissions can land after
	 * this page opens (they are loaded without being awaited at start-up), so
	 * they are followed rather than read once; when the answer changes, the
	 * timesheets are read again with or without the employee.
	 */
	private _applyEmployeePermission() {
		this.store.userRolePermissions$
			.pipe(
				map(() => this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)),
				distinctUntilChanged(),
				filter((showEmployee: boolean) => showEmployee !== this.showEmployee),
				tap((showEmployee: boolean) => (this.showEmployee = showEmployee)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
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
				title: this.getTranslation('TIMESHEET.APPROVE'),
				data: { status: TimesheetStatus.APPROVED }
			},
			{
				title: this.getTranslation('TIMESHEET.DENY'),
				data: { status: TimesheetStatus.DENIED }
			}
		];
	}

	/**
	 * Counts the timesheets of each status. A status the period has none of is
	 * left out, unless it is the one the list is narrowed to.
	 */
	private _buildStatusOptions() {
		const counts = new Map<TimesheetStatus, number>();
		this.timesheets.forEach((timesheet: ITimesheet) =>
			counts.set(timesheet.status, (counts.get(timesheet.status) || 0) + 1)
		);
		this.statusOptions = [
			{ status: null, count: this.timesheets.length },
			...STATUS_ORDER.filter((status) => counts.has(status) || status === this.statusFilter).map((status) => ({
				status,
				count: counts.get(status) || 0
			}))
		];
	}

	/**
	 * Checks if at least one timesheet in the list has its checkbox selected.
	 * @returns True if a timesheet's checkbox is selected, otherwise false.
	 */
	isCheckboxSelected(): boolean {
		return !!this.visibleTimesheets.find((timesheet: ITimesheet) => timesheet['checked'] === true);
	}

	/**
	 * Prepare timesheets ids payload
	 *
	 * @param timesheetIds
	 * @returns
	 */
	prepareTimesheetIds(timesheetIds: string | string[]): string[] {
		return typeof timesheetIds === 'string' ? [timesheetIds] : timesheetIds;
	}

	ngOnDestroy(): void {}
}

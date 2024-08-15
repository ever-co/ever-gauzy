import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
	ISubmitTimesheetInput,
	ITimesheet,
	IUpdateTimesheetStatusInput,
	PermissionsEnum,
	TimesheetStatus
} from '@gauzy/contracts';
import { NbMenuItem, NbMenuService } from '@nebular/theme';
import { debounceTime, filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { isEmpty } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetService, ToastrService } from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-timesheet-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent extends BaseSelectorFilterComponent implements AfterViewInit, OnInit, OnDestroy {
	timesheets: ITimesheet[] = [];
	contextMenus: NbMenuItem[] = [];

	loading: boolean = false;
	allChecked: boolean = false;
	disableButton: boolean = true;

	TimesheetStatus = TimesheetStatus;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	selectedTimesheet: {
		data: ITimesheet;
		isSelected: boolean;
	};

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
		this._applyTranslationOnChange();
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this._clearItem()),
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

	async getTimeSheets() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.timesheets = await this.timesheetService.getTimeSheets({
				...this.getFilterRequest(this.request),
				relations: [
					...(this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
						? ['employee', 'employee.user']
						: [])
				]
			});
		} catch (error) {
			console.log('Error while getting timesheets for selected date range');
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Update timesheets status
	 *
	 * @param timesheetIds
	 * @param status
	 * @returns
	 */
	updateStatus(timesheetIds: string | string[], status: TimesheetStatus) {
		if (!this.organization || isEmpty(timesheetIds)) {
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
				this.subject$.next(true);
			});
	}

	submitTimesheet(timesheetIds: string | string[], status: 'submit' | 'unsubmit') {
		if (!this.organization || isEmpty(timesheetIds)) {
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
				this.subject$.next(true);
			});
	}

	/**
	 * Bulk action for APPROVED/DENIED timesheet
	 *
	 * @param status
	 */
	bulkAction(status: TimesheetStatus) {
		const timeSheetIds = this.timesheets
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
		this.timesheets.forEach((timesheet: any) => (timesheet.checked = checked));
	}

	/**
	 * Is Indeterminate
	 *
	 * @returns
	 */
	isIndeterminate() {
		const c1 = this.timesheets.filter((t: any) => t.checked).length > 0;
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
		this.allChecked = this.timesheets.every((t: any) => t.checked);
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

	public statusMapper = (timesheet: ITimesheet) => {
		let badgeClass: string;
		const status = timesheet.status;
		if (status) {
			switch (status) {
				case TimesheetStatus.APPROVED:
					badgeClass = 'success';
					break;
				case TimesheetStatus.DENIED:
					badgeClass = 'danger';
					break;
				case TimesheetStatus.PENDING:
					badgeClass = 'primary';
					break;
				case TimesheetStatus.DRAFT:
					badgeClass = 'warning';
					break;
				default:
					badgeClass = 'primary';
					break;
			}
			return {
				text: status,
				class: badgeClass
			};
		}
	};

	selectTimesheet({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedTimesheet = {
			isSelected: isSelected,
			data: isSelected ? data : null
		};
	}

	/*
	 * Clear selected item
	 */
	private _clearItem() {
		this.selectTimesheet({
			isSelected: false,
			data: null
		});
	}

	/**
	 * User Select Single Row
	 *
	 * @param timesheet
	 */
	userRowSelect(timesheet: ITimesheet) {
		// if row is already selected, deselect it.
		if (timesheet['isSelected']) {
			timesheet['isSelected'] = false;
			this.selectTimesheet({
				isSelected: timesheet['isSelected'],
				data: null
			});
		} else {
			// find the row which was previously selected.
			const isRowSelected = this.timesheets.find((item: ITimesheet) => item['isSelected'] === true);
			if (!!isRowSelected) {
				// if row found successfully, mark that row as deselected
				isRowSelected['isSelected'] = false;
			}
			// mark new row as selected
			timesheet['isSelected'] = true;
			this.selectTimesheet({
				isSelected: timesheet['isSelected'],
				data: timesheet
			});
		}
	}

	/**
	 * Checks if at least one timesheet in the list is selected.
	 * @returns True if a timesheet is selected, otherwise false.
	 */
	isRowSelected(): boolean {
		return !!this.timesheets.find((timesheet: ITimesheet) => timesheet['isSelected'] === true);
	}

	/**
	 * Checks if at least one timesheet in the list has its checkbox selected.
	 * @returns True if a timesheet's checkbox is selected, otherwise false.
	 */
	isCheckboxSelected(): boolean {
		return !!this.timesheets.find((timesheet: ITimesheet) => timesheet['checked'] === true);
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

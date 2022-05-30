import {
	AfterViewInit,
	Component,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { ITimeLogFilters, ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common-angular';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { debounceTime, filter, map, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	TimesheetService,
	TimesheetFilterService,
	EditTimeLogModalComponent
} from './../../../../../@shared/timesheet';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import {
	DateRangePickerBuilderService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-timesheet-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent
	extends BaseSelectorFilterComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	logRequest: ITimeLogFilters = this.request;
	timesheets: ITimesheet[] = [];

	showBulkAction: boolean;
	loading: boolean;

	TimesheetStatus = TimesheetStatus;
	contextMenus: NbMenuItem[];

	timesheets$: Subject<any> = this.subject$;

	allChecked: boolean;

	@ViewChild(GauzyFiltersComponent)
	gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> =
		this._dateRangePickerBuilderService.datePickerConfig$;

	selectedTimesheet = {
		data: null,
		isSelected: false
	};
	disable = true;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly nbMenuService: NbMenuService,
		public readonly translateService: TranslateService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this._applyTranslationOnChange();
		this.timesheets$
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

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.timesheets$.next(true);
	}

	async getTimeSheets() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		this.loading = true;
		try {
			this.timesheets = await this.timesheetService
				.getTimeSheets({
					...this.getFilterRequest(this.logRequest)
				})
				.finally(() => (this.loading = false));
		} catch (error) {
			console.log(
				'Error while getting timesheets for selected date range'
			);
		}
	}

	updateStatus(timesheetIds: string | string[], status: TimesheetStatus) {
		this.timesheetService
			.updateStatus(timesheetIds, status)
			.then(() => {
				if (status === TimesheetStatus.APPROVED) {
					this.toastrService.success('TIMESHEET.APPROVE_SUCCESS');
				} else if (status === TimesheetStatus.DENIED) {
					this.toastrService.success('TIMESHEET.DENIED_SUCCESS');
				}
			})
			.finally(() => {
				this.timesheets$.next(true);
			});
	}

	submitTimesheet(
		timesheetIds: string | string[],
		status: 'submit' | 'unsubmit'
	) {
		this.timesheetService
			.submitTimesheet(timesheetIds, status)
			.then(() => {
				if (status === 'submit') {
					this.toastrService.success('TIMESHEET.SUBMIT_SUCCESS');
				} else if (status === 'unsubmit') {
					this.toastrService.success('TIMESHEET.UNSUBMIT_SUCCESS');
				}
			})
			.finally(() => {
				this.timesheets$.next(true);
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
		this.timesheets.forEach(
			(timesheet: any) => (timesheet.checked = checked)
		);
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
		this.selectTimesheet(timesheet, checked);
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

	public selectTimesheet(timesheet: ITimesheet, isChecked: boolean) {
		if (
			!isChecked &&
			this.selectedTimesheet.data &&
			this.selectedTimesheet.data.id === timesheet?.id
		) {
			this.clearData();
		} else {
			this.disable = true;
			this.selectedTimesheet.isSelected = this.disable;
			this.selectedTimesheet.data = timesheet;
		}
	}

	public clearData() {
		this.selectedTimesheet = {
			data: null,
			isSelected: false
		};
		this.disable = true;
	}

	public openAdd() {
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

	ngOnDestroy(): void {}
}

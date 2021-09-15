import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
	IOrganization,
	ITimeLogFilters,
	ITimesheet,
	TimesheetStatus,
	IGetTimesheetInput,
} from '@gauzy/contracts';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import { NbMenuItem, NbMenuService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, map, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { Store, ToastrService } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent 
	extends TranslationBaseComponent 
	implements AfterViewInit, OnInit, OnDestroy {

	logRequest: ITimeLogFilters;
	timesheets: ITimesheet[] = [];

	showBulkAction: boolean;
	loading: boolean;

	TimesheetStatus = TimesheetStatus;
	contextMenus: NbMenuItem[];

	public organization: IOrganization;
	timesheets$: Subject<any> = new Subject();
	selectedEmployeeId: string;

	allChecked: boolean;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly nbMenuService: NbMenuService,
		public readonly translate: TranslateService,
	) {
		super(translate);
	}

	ngOnInit() {
		this._applyTranslationOnChange();
		this.timesheets$
			.pipe(
				debounceTime(500),
				tap(() => this.loading = true),
				tap(() => this.getTimeSheets()),
				tap(() => this.allChecked = false),
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

		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this.timesheets$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.timesheetFilterService.filter = $event;
		this.timesheets$.next();
	}

	async getTimeSheets() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = this.logRequest;

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const request: IGetTimesheetInput = {
			organizationId,
			tenantId,
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
		};

		await this.timesheetService
			.getTimeSheets(request)
			.then((timesheets: ITimesheet[]) => {
				this.timesheets = timesheets;
			})
			.finally(() => (this.loading = false));
	}

	updateStatus(timesheetIds: string | string[], status: TimesheetStatus) {
		this.timesheetService.updateStatus(timesheetIds, status)
			.then(() => {
				if (status === TimesheetStatus.APPROVED) {
					this.toastrService.success('TIMESHEET.APPROVE_SUCCESS');
				} else if (status === TimesheetStatus.DENIED) {
					this.toastrService.success('TIMESHEET.DENIED_SUCCESS');
				}
			})
			.finally(() => {
				this.timesheets$.next();
			});
	}

	submitTimesheet(
		timesheetIds: string | string[],
		status: 'submit' | 'unsubmit'
	) {
		this.timesheetService.submitTimesheet(timesheetIds, status)
			.then(() => {
				if (status === 'submit') {
					this.toastrService.success('TIMESHEET.SUBMIT_SUCCESS');
				} else if (status === 'unsubmit') {
					this.toastrService.success('TIMESHEET.UNSUBMIT_SUCCESS');
				}
			})
			.finally(() => {
				this.timesheets$.next();
			});
	}

	/**
	 * Bulk action for APPROVED/DENIED timesheet
	 * 
	 * @param status 
	 */
	bulkAction(status: TimesheetStatus) {
		const timeSheetIds = this.timesheets.filter(
			(timesheet: ITimesheet) => timesheet['checked']
		).map(
			(timesheet: ITimesheet) => timesheet.id
		);
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
		if (!timesheet) { return; }

		this.router.navigate([
			'/pages/employees/timesheets', timesheet.id
		]);
	}

	/**
	 * Checked/Un-Checked Checkbox
	 * 
	 * @param checked 
	 */
	checkedAll(checked: boolean) {
		this.allChecked = checked;
		this.timesheets.forEach((timesheet: any) => timesheet.checked = checked);
	}

	/**
	 * Is Indeterminate
	 * 
	 * @returns 
	 */
	isIndeterminate() {
		const c1 = (this.timesheets.filter((t: any) => t.checked).length > 0);
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
		this.translate.onLangChange
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

	ngOnDestroy(): void {}
}

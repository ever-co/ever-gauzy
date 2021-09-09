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
import {
	NbDialogRef,
	NbMenuService
} from '@nebular/theme';
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

	logRequest: ITimeLogFilters = {};
	timeSheets: ITimesheet[] = [];
	selectedIds: any = {};

	showBulkAction: boolean = false;
	loading: boolean;

	TimesheetStatus = TimesheetStatus;
	bulkActionOptions = [
		{
			title: 'Approve'
		},
		{
			title: 'Deny'
		}
	];
	dialogRef: NbDialogRef<any>;

	public organization: IOrganization;
	timesheets$: Subject<any> = new Subject();
	selectedEmployeeId = null;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly nbMenuService: NbMenuService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.timesheets$
			.pipe(
				debounceTime(500),
				tap(() => this.loading = true),
				tap(() => this.getTimeSheets()),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbMenuService
			.onItemClick()
			.pipe(
				untilDestroyed(this),
				filter(({ tag }) => tag === 'timesheet-bulk-action'),
				map(({ item: { title } }) => title),
				tap((title) => this.bulkAction(title))
			)
			.subscribe();
	}

	ngAfterViewInit() {
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

		this.timeSheets = await this.timesheetService
			.getTimeSheets(request)
			.then((logs) => {
				this.selectedIds = {};
				logs.forEach((log) => (this.selectedIds[log.id] = false));
				return logs;
			})
			.finally(() => (this.loading = false));
	}

	updateStatus(timesheetId: string | string[], status: TimesheetStatus) {
		this.timesheetService.updateStatus(timesheetId, status)
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
		timesheetId: string | string[],
		status: 'submit' | 'unsubmit'
	) {
		this.timesheetService.submitTimesheet(timesheetId, status)
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

	bulkAction(action) {
		const timeSheetIds = [];
		for (const key in this.selectedIds) {
			if (this.selectedIds.hasOwnProperty(key)) {
				const is_checked = this.selectedIds[key];
				if (is_checked) {
					timeSheetIds.push(key);
				}
			}
		}

		if (action === 'Approve') {
			this.updateStatus(timeSheetIds, TimesheetStatus.APPROVED);
		}
		if (action === 'Deny') {
			this.updateStatus(timeSheetIds, TimesheetStatus.DENIED);
		}
	}

	redirectToView(timesheet: ITimesheet) {
		if (!timesheet) { return; }

		this.router.navigate([
			'/pages/employees/timesheets', timesheet.id
		]);
	}

	ngOnDestroy(): void {}
}

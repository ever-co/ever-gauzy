// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { filter, map, debounceTime, tap } from 'rxjs/operators';
import {
	BehaviorSubject,
	Observable,
	Subject,
	catchError,
	combineLatest,
	finalize,
	firstValueFrom,
	from,
	of,
	switchMap,
	takeUntil
} from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pick } from 'underscore';
import * as moment from 'moment';
import { IGetTimeLogInput, ITimeLog, PermissionsEnum, ITimeLogFilters, TimeLogSourceEnum } from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	IDatePickerConfig,
	Store,
	TimeTrackerService,
	TimesheetFilterService,
	TimesheetService,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	BaseSelectorFilterComponent,
	ConfirmComponent,
	EditTimeLogModalComponent,
	GauzyFiltersComponent,
	TimeZoneService,
	ViewTimeLogModalComponent
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-daily-timesheet',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent extends BaseSelectorFilterComponent implements AfterViewInit, OnInit, OnDestroy {
	public PermissionsEnum = PermissionsEnum; // Enum for permissions.
	public logs$: Observable<ITimeLog[]>; // Observable for an array of Time Logs.
	public logs: ITimeLog[] = []; // Array of organization time logs.
	public loading = false; // Flag to indicate if data loading is in progress.
	public disableButton = true; // Flag to indicate if button is disabled.
	public allChecked = false; // All checked flag.
	public filters: ITimeLogFilters = this.request; // Time log filters. Assuming request is defined somewhere.
	public contextMenus: NbMenuItem[] = [];
	public limitReached = false;

	//Reference to the GauzyFiltersComponent using @ViewChild.
	@ViewChild(GauzyFiltersComponent) private readonly gauzyFiltersComponent: GauzyFiltersComponent;

	// Observable containing the date picker configuration.
	public datePickerConfig$: Observable<IDatePickerConfig> = this.dateRangePickerBuilderService.datePickerConfig$;

	// BehaviorSubject holding the time log filters as payloads.
	private readonly payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	// Declare a subject to trigger refresh
	private readonly refreshTrigger$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
	private readonly workedThisWeek$: Observable<number> = this._timeTrackerService.workedThisWeek$;
	private readonly reWeeklyLimit$: Observable<number> = this._timeTrackerService.reWeeklyLimit$;
	private readonly destroy$ = new Subject<void>();

	// Represents the selected log along with its selection status.
	public selectedLog: {
		data: ITimeLog;
		isSelected: boolean;
	};

	constructor(
		public readonly translateService: TranslateService,
		private readonly _timesheetService: TimesheetService,
		private readonly _timeTrackerService: TimeTrackerService,
		private readonly _dialogService: NbDialogService,
		private readonly _nbMenuService: NbMenuService,
		private readonly _timesheetFilterService: TimesheetFilterService,
		private readonly _route: ActivatedRoute,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	/**
	 *
	 */
	ngOnInit() {
		this._handleSubjectOperationsSubscriber();
		this._handleUpdateLogSubscriber();
		this._handleRefreshDailyLogs();
		this._getDailyTimesheetLogs();
		combineLatest([this.workedThisWeek$, this.reWeeklyLimit$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(() => {
				this.limitReached = this._timeTrackerService.hasReachedWeeklyLimit();
			});
	}

	/**
	 *
	 */
	ngAfterViewInit() {
		this._createContextMenus();
		this._applyTranslationOnContextMenu();
		this._handleItemClickSubscriber();
		this._handleQueryParamMapSubscriber();
	}

	// Subscribe to the subject and perform operations.
	private _handleSubjectOperationsSubscriber(): void {
		this.subject$
			.pipe(
				// Filter to ensure there is a valid organization
				filter(() => !!this.organization),
				// Tap to prepare the request
				tap(() => this.prepareRequest()),
				// Tap to set allChecked to false
				tap(() => (this.allChecked = false)),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	// Subscribe to the updateLog$ observable and perform operations.
	private _handleUpdateLogSubscriber(): void {
		this._timesheetService.updateLog$
			.pipe(
				// Filter to ensure the value is true
				filter((val) => val === true),
				// Tap to trigger the subject$
				tap(() => this.subject$.next(true)),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	// Subscribe to the onItemClick event and perform operations.
	private _handleItemClickSubscriber(): void {
		this._nbMenuService
			.onItemClick()
			.pipe(
				// Filter to ensure the correct tag and action
				filter(({ tag, item }) => tag === 'time-logs-bulk-action' && item?.data.action === 'DELETE'),
				// Map to extract the action from the menu item
				map(({ item }) => item.data.action),
				// Tap to execute the bulk delete action
				tap(() => this._bulkDeleteAction()),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	// Subscribe to the queryParamMap changes and perform operations.
	private _handleQueryParamMapSubscriber(): void {
		this._route.queryParamMap
			.pipe(
				// Debounce time to wait for a pause in events
				debounceTime(500),
				// Filter to ensure there are parameters
				filter((params: ParamMap) => !!params),
				// Filter to ensure 'openAddDialog' is 'true'
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				// Tap to open the add dialog
				tap(() => this.openAdd()),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieves daily time logs based on payloads and handles observables.
	 */
	private _getDailyTimesheetLogs() {
		this.logs$ = this.payloads$.pipe(
			// Ensure payload changes are distinct
			distinctUntilChange(),
			// Filter to ensure a valid organization and payloads
			filter((payloads: ITimeLogFilters) => !!this.organization && !!payloads),
			// SwitchMap to fetch time logs using provided payloads
			switchMap(() => this._getDailyLogs()),
			// Ensure lifecycle management to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Handles the refresh of daily time logs.
	 */
	private _handleRefreshDailyLogs() {
		this.refreshTrigger$
			.pipe(
				// Filter to ensure a valid organization
				filter((value) => !!this.organization && !!value),
				// SwitchMap to fetch time logs using provided payloads
				switchMap(() => this._getDailyLogs()),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieves daily time logs based on payloads and handles observables.
	 */
	private _getDailyLogs(): Observable<ITimeLog[]> {
		// Extract organizationId from the organization object
		const organizationId = this.organization?.id;

		// Check for a valid organization; return empty array if not valid
		if (!organizationId) {
			return of([]); // No valid organization, return empty array
		}

		// Set loading to true
		this.loading = true;

		// Get the current payloads value
		const payloads = this.payloads$.getValue();

		// Invoke the service to fetch time logs with given payloads
		const api$ = this._timesheetService.getTimeLogs(payloads, [
			'project',
			'task',
			'organizationContact',
			'employee.user'
		]);

		// Convert the promise-based API call to an observable
		return from(api$).pipe(
			// Handle API call errors and log them
			catchError((error) => {
				console.error('Error while retrieving daily time logs entries', error);
				this._errorHandlingService.handleError(error);
				return of([]); // Return an empty observable to continue stream
			}),
			// Update component state with fetched issues
			tap((logs: ITimeLog[]) => {
				this.logs = logs;
			}),
			// Finalize to set loading to false
			finalize(() => {
				this.loading = false;
			}),
			// Ensure lifecycle management to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Handles changes to time log filters.
	 *
	 * @param filters - The time log filters to apply.
	 */
	filtersChange(filters: ITimeLogFilters): void {
		if (this.gauzyFiltersComponent.saveFilters) {
			// Save filters if the condition is met
			this._timesheetFilterService.filter = filters;
		}
		// Update the component's filters
		this.filters = { ...filters };
		// Trigger the subject to notify subscribers
		this.subject$.next(true);
	}

	/**
	 * Prepares a unique request based on filters and request data.
	 *
	 * @returns {void}
	 */
	prepareRequest(): void {
		// Check if either request or filters is empty
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Pick specific properties from filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		// Create a request object by combining appliedFilter and processed request
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};

		// Update the payloads$ BehaviorSubject with the new request
		this.payloads$.next(request);
	}

	/**
	 * Opens the Add Time Log modal and handles the result.
	 */
	openAdd(): void {
		if (this.limitReached) return;
		const defaultTimeLog = {
			startedAt: moment().set({ hour: 8, minute: 0, second: 0 }).toDate(),
			stoppedAt: moment().set({ hour: 9, minute: 0, second: 0 }).toDate(),
			employeeId: this.request.employeeIds?.[0] || null,
			projectId: this.request.projectIds?.[0] || null
		};

		this._dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog: defaultTimeLog } })
			.onClose.pipe(
				// Filter out falsy results
				filter((timeLog: ITimeLog) => !!timeLog),
				// Tap to refresh the date range picker
				tap((timeLog: ITimeLog) => {
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(timeLog.startedAt));
				}),
				// Tap to notify subscribers
				tap(() => this.refreshTrigger$.next(true)),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens the Edit Time Log modal and handles the result.
	 *
	 * @param timeLog - The time log to edit.
	 */
	openEdit(timeLog: ITimeLog): void {
		if (timeLog.isRunning) {
			return;
		}

		this._dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(
				// Filter out falsy results
				filter((editedTimeLog: ITimeLog) => !!editedTimeLog),
				// Tap to refresh the date range picker
				tap((editedTimeLog: ITimeLog) => {
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(editedTimeLog.startedAt));
				}),
				// Tap to notify subscribers
				tap(() => this.refreshTrigger$.next(true)),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens the View Time Log modal and handles the result.
	 *
	 * @param timeLog - The time log to view.
	 */
	openView(timeLog: ITimeLog): void {
		this._dialogService
			.open(ViewTimeLogModalComponent, {
				context: { timeLog },
				dialogClass: 'view-log-dialog'
			})
			.onClose.pipe(
				// Filter out falsy results
				filter((data) => !!data),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.refreshTrigger$.next(true);
			});
	}

	/**
	 * Deletes a time log after confirming it's not currently running.
	 * @param timeLog - The time log to be deleted.
	 */
	async onDeleteConfirm(timeLog: ITimeLog) {
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
			// Use await to wait for the promise to resolve
			await this._timesheetService.deleteLogs(request);

			// Move the checkTimerStatus call outside the try block for consistency
			this.checkTimerStatus();

			// Display success message
			this._toastrService.success('TOASTR.MESSAGE.TIME_LOG_DELETED', {
				name: employee.fullName,
				organization: this.organization.name
			});
		} catch (error) {
			console.error('Error occurred while deleting TimeLog. Error Details:', error);
			this._toastrService.danger(error);
		} finally {
			this.refreshTrigger$.next(true);
		}
	}

	/**
	 * Opens a confirmation dialog for deleting time logs.
	 * @returns An Observable that emits `true` when the user confirms the deletion, and completes.
	 */
	private _confirmDeleteDialog(): Observable<boolean> {
		const confirmDialog$ = this._dialogService.open(ConfirmComponent, {
			context: {
				data: {
					message: this.translateService.instant('TIMESHEET.DELETE_TIMELOG')
				}
			}
		});
		return confirmDialog$.onClose.pipe(filter(Boolean), untilDestroyed(this));
	}

	/**
	 * Get the IDs of selected and non-running time logs.
	 * @returns An array of string IDs.
	 */
	private getSelectedLogIds(): string[] {
		return this.logs
			.filter((timeLog: ITimeLog) => timeLog['checked'] && !timeLog.isRunning)
			.map((timeLog: ITimeLog) => timeLog.id);
	}

	/**
	 * Perform bulk deletion of selected time logs.
	 */
	private async _bulkDeleteAction(): Promise<void> {
		const confirmed = await firstValueFrom(this._confirmDeleteDialog());
		//
		if (confirmed) {
			try {
				const logIds = this.getSelectedLogIds();
				const { id: organizationId, tenantId } = this.organization;

				// Use await to wait for the promise to resolve
				await this._timesheetService.deleteLogs({ logIds, organizationId, tenantId });

				// Move the checkTimerStatus call outside the try block for consistency
				this.checkTimerStatus();

				// Display success message
				this._toastrService.success('TOASTR.MESSAGE.TIME_LOGS_DELETED', {
					organization: this.organization.name
				});
			} catch (error) {
				console.error('Error occurred while deleting multiple time logs. Error Details:', error);
				this._toastrService.danger(error);
			} finally {
				this.refreshTrigger$.next(true);
			}
		}
	}

	/**
	 * Checks the timer status for the current user and organization.
	 */
	private async checkTimerStatus(): Promise<void> {
		if (!this.organization) {
			return;
		}

		const { employeeId, tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (employeeId) {
			try {
				await this._timeTrackerService.checkTimerStatus({
					organizationId,
					tenantId,
					source: TimeLogSourceEnum.WEB_TIMER
				});
			} catch (error) {
				// Handle the error or display a message if needed
				console.error('Error while checking timer status:', error);
			}
		}
	}

	/**
	 * Updates the checked status for all non-running time logs.
	 *
	 * @param checked - A boolean value indicating whether to check or uncheck all time logs.
	 */
	public checkedAll(checked: boolean): void {
		this.allChecked = checked;

		// Update the checked status for non-running time logs
		this.logs
			.filter((timeLog: ITimeLog) => !timeLog.isRunning)
			.forEach((timesheet: any) => (timesheet.checked = checked));
	}

	/**
	 * Checks if any time log is in an indeterminate state.
	 * @returns True if at least one time log is checked and not all time logs are checked; otherwise, false.
	 */
	public isIndeterminate(): boolean {
		const hasCheckedLogs = this.logs.some((timeLog: ITimeLog) => timeLog['checked']);
		return hasCheckedLogs && !this.allChecked;
	}

	/**
	 * Toggles the checkbox for a specific time log.
	 * @param checked - The new checked state.
	 * @param timeLog - The time log to update.
	 */
	public toggleCheckbox(checked: boolean, timeLog: ITimeLog): void {
		if (timeLog.isRunning) {
			return;
		}

		timeLog['checked'] = checked;
		this.allChecked = this.logs.every((log: ITimeLog) => log['checked']);
	}

	/**
	 * Apply translation on context menus.
	 */
	private _applyTranslationOnContextMenu(): void {
		this.translateService.onLangChange
			.pipe(
				// Tap to recreate context menus on language change
				tap(() => this._createContextMenus()),
				// Ensure lifecycle management to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Creates context menus based on user permissions.
	 */
	private _createContextMenus(): void {
		const deletePermission = this.store.hasAnyPermission(PermissionsEnum.ALLOW_DELETE_TIME);

		this.contextMenus = deletePermission
			? [
					{
						title: this.getTranslation('TIMESHEET.DELETE'),
						data: {
							action: 'DELETE'
						}
					}
			  ]
			: [];
	}

	/**
	 * Handles the selection of a time log.
	 * @param {boolean} isSelected - Indicates whether the time log is selected.
	 * @param {ITimeLog} data - The data associated with the time log.
	 */
	selectTimeLog({ isSelected, data }: { isSelected: boolean; data: ITimeLog }): void {
		this.disableButton = !isSelected;
		this.selectedLog = {
			isSelected,
			data: isSelected ? data : null
		};
	}

	/**
	 * Handles user selection of a single row.
	 * @param timeLog - The time log to be selected or deselected.
	 */
	userRowSelect(timeLog: ITimeLog): void {
		if (timeLog['isSelected']) {
			timeLog['isSelected'] = false;
			this.selectTimeLog({
				isSelected: false,
				data: null
			});
		} else {
			// find the row which was previously selected.
			const previouslySelectedRow = this.logs.find((item: ITimeLog) => item['isSelected']);

			if (previouslySelectedRow) {
				// if row found successfully, mark that row as deselected
				previouslySelectedRow['isSelected'] = false;
			}

			// mark new row as selected
			timeLog['isSelected'] = true;
			this.selectTimeLog({
				isSelected: true,
				data: timeLog
			});
		}
	}

	/**
	 * Checks if at least one time log in the list is selected.
	 * @returns True if a time log is selected, otherwise false.
	 */
	isRowSelected(): boolean {
		return !!this.logs.find((log: ITimeLog) => log['isSelected']);
	}

	/**
	 * Checks if at least one time log in the list has its checkbox selected.
	 * @returns True if a time log's checkbox is selected, otherwise false.
	 */
	isCheckboxSelected(): boolean {
		return !!this.logs.find((log: ITimeLog) => log['checked']);
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}

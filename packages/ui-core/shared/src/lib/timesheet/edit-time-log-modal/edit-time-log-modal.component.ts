import { Component, OnInit, Input, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, debounceTime, filter, Subject, Subscription, tap } from 'rxjs';
import * as moment from 'moment';
import { omit } from 'underscore';
import {
	IDateRange,
	IOrganization,
	ITimeLog,
	PermissionsEnum,
	IGetTimeLogConflictInput,
	ISelectedEmployee,
	TimeLogType,
	TimeLogSourceEnum
} from '@gauzy/contracts';
import { toUTC, toLocal, distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, TimesheetService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-time-log-modal',
	templateUrl: './edit-time-log-modal.component.html',
	styleUrls: ['./edit-time-log-modal.component.scss']
})
export class EditTimeLogModalComponent implements OnInit, AfterViewInit, OnDestroy {
	// Permissions and basic state initialization
	PermissionsEnum = PermissionsEnum;
	organization: IOrganization;
	today: Date = new Date();
	mode: 'create' | 'update' = 'create';
	loading = false;
	overlaps: ITimeLog[] = [];

	// Date range and time-related properties
	selectedRange: IDateRange = { start: null, end: null };
	timeDiff: number = null;

	// Employee-related properties
	employee: ISelectedEmployee;
	futureDateAllowed = false;
	subject$: Subject<boolean> = new Subject();

	// Additional properties
	reasons: string[] = ['Worked offline', 'Internet issue', 'Forgot to track', 'Usability issue', 'App issue'];
	selectedReason = '';
	selectedRangeSubscription: Subscription;
	isTimeRangeValid = true;

	// Time log state management
	private _timeLog: ITimeLog | Partial<ITimeLog> = {};
	@Input() set timeLog(value: ITimeLog | Partial<ITimeLog>) {
		this._timeLog = { ...value }; // Shallow copy to avoid mutation
		this.mode = this._timeLog?.id ? 'update' : 'create';
	}
	get timeLog(): ITimeLog | Partial<ITimeLog> {
		return this._timeLog;
	}

	/*
	 * TimeLog Mutation Form
	 */
	public form: FormGroup = EditTimeLogModalComponent.buildForm(this._fb, this);
	static buildForm(fb: FormBuilder, self: EditTimeLogModalComponent): FormGroup {
		return fb.group({
			isBillable: [true],
			employeeId: [null, Validators.required],
			projectId: [],
			organizationContactId: [],
			organizationTeamId: [],
			taskId: [],
			description: [],
			reason: [],
			selectedRange: [self.selectedRange]
		});
	}

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _dialogRef: NbDialogRef<EditTimeLogModalComponent>,
		private readonly _store: Store,
		private readonly _timesheetService: TimesheetService,
		private readonly _toastrService: ToastrService
	) {}

	ngOnInit() {
		const { startedAt, stoppedAt } = this.timeLog;
		this.selectedRange = {
			start: moment(startedAt).toDate(),
			end: moment(stoppedAt).toDate()
		};

		// Subscribe to subject for overlap checks
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.checkOverlaps()),
				untilDestroyed(this)
			)
			.subscribe();

		// Subscribe to selected organization
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.futureDateAllowed = organization.futureDateAllowed;
				}),
				untilDestroyed(this)
			)
			.subscribe();

		const employeeId$ = this.form.get('employeeId').valueChanges;
		const selectedRange$ = this.form.get('selectedRange').valueChanges;
		this.selectedRangeSubscription = selectedRange$.subscribe((selectedRange) => {
			this.selectedRange = selectedRange;
			const { start, end } = selectedRange;
			this.timeDiff = start && end ? this.calculateTimeDiff(start, end) : null;
		});

		// Combine employeeId and selectedRange value changes
		combineLatest([employeeId$, selectedRange$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([employeeId, selectedRange]) => !!employeeId && !!selectedRange),
				tap(([employeeId, selectedRange]) => {
					this.employee = employeeId;
					this.selectedRange = selectedRange;

					const { start, end } = selectedRange;

					this.timeDiff = start && end ? this.calculateTimeDiff(start, end) : null;

					// Notify subject about changes
					this.subject$.next(true);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		if (!this._timeLog) {
			return;
		}

		// Initialize form with the time log values
		this.populateFormWithTimeLog(this._timeLog);
	}

	/**
	 * Populates the form with time log data.
	 *
	 * @param {ITimeLog} timeLog - The time log object containing data to set in the form.
	 * @returns {void}
	 */
	private populateFormWithTimeLog(timeLog: Partial<ITimeLog>): void {
		this.form.setValue({
			isBillable: timeLog.isBillable ?? true,
			employeeId: timeLog.employeeId ?? this._store.selectedEmployee.id,
			projectId: timeLog.projectId ?? null,
			organizationContactId: timeLog.organizationContactId ?? null,
			organizationTeamId: timeLog.organizationTeamId ?? null,
			taskId: timeLog.taskId ?? null,
			description: timeLog.description ?? null,
			reason: timeLog.reason ?? null,
			selectedRange: {
				start: timeLog.startedAt,
				end: timeLog.stoppedAt
			}
		});

		// Trigger manual change detection
		this._cdr.detectChanges();
	}

	/**
	 * Helper function to calculate time difference
	 */
	private calculateTimeDiff(start: Date, end: Date): number | null {
		const startMoment = moment(start);
		const endMoment = moment(end);

		if (startMoment.isValid() && endMoment.isValid()) {
			return endMoment.diff(startMoment, 'seconds');
		} else {
			return null;
		}
	}

	onDateRangeChange(newRange: IDateRange) {
		this.selectedRange = newRange;
		this._cdr.detectChanges();
	}

	onValidationChange(isValid: boolean) {
		this.isTimeRangeValid = isValid;
	}

	/**
	 * Closes the dialog or modal window.
	 *
	 * - Closes the currently active dialog by passing a `null` result to indicate
	 *   that no action or result needs to be returned.
	 *
	 * @returns {void}
	 */
	close(): void {
		this._dialogRef.close(null);
	}

	/**
	 * Checks for overlapping time logs for a selected employee and time range.
	 *
	 * - Retrieves the form data and organization details, then sends a request to check for overlaps.
	 * - Calculates the overlap duration between time logs and maps the result.
	 * - Displays any errors using the toastr service.
	 *
	 * @returns {Promise<void>} - Resolves when the overlaps are checked.
	 */
	async checkOverlaps(): Promise<void> {
		// Ensure the organization is available
		if (!this.organization) {
			return;
		}

		// Extract necessary values from form and store
		const { employeeId } = this.form.value;
		const { id: organizationId, tenantId } = this.organization;

		// Proceed only if a time range and employee ID are selected
		if (this.selectedRange && employeeId) {
			const { start, end } = this.selectedRange;
			const startDate = toUTC(start).toISOString();
			const endDate = toUTC(end).toISOString();

			// Exit if either start or end date is missing
			if (!startDate || !endDate) {
				return;
			}

			// Build the request payload
			const request: IGetTimeLogConflictInput = {
				...(this.timeLog.id ? { ignoreId: [this.timeLog.id] } : {}),
				startDate,
				endDate,
				employeeId,
				tenantId,
				organizationId,
				relations: ['project', 'task']
			};

			try {
				// Call the service to check for overlapping time logs
				const timeLogs = await this._timesheetService.checkOverlaps(request);

				// If no overlaps found, return early
				if (!timeLogs) {
					return;
				}

				// Calculate overlap duration and map the results
				this.overlaps = timeLogs.map((timeLog: ITimeLog) => {
					const timeLogStartedAt = toLocal(timeLog.startedAt);
					const timeLogStoppedAt = toLocal(timeLog.stoppedAt);

					// Calculate overlap duration
					const overlapDuration = this.calculateOverlapDuration(
						timeLogStartedAt.toDate(),
						timeLogStoppedAt.toDate(),
						startDate,
						endDate
					);

					// Assign overlap duration to timeLog
					timeLog['overlapDuration'] = overlapDuration;
					return timeLog;
				});
			} catch (error) {
				console.error('Error while checking overlapping time log entries for employee', error);
				this._toastrService.danger('Error checking overlapping time logs');
			}
		}
	}

	/**
	 * Calculates the overlap duration between two date ranges.
	 *
	 * @param {Date} timeLogStart - Start date of the existing time log.
	 * @param {Date} timeLogEnd - End date of the existing time log.
	 * @param {string} selectedStart - Start date of the selected range.
	 * @param {string} selectedEnd - End date of the selected range.
	 * @returns {number} - Duration of the overlap in seconds.
	 */
	private calculateOverlapDuration(
		timeLogStart: Date,
		timeLogEnd: Date,
		selectedStart: string,
		selectedEnd: string
	): number {
		const selectedStartMoment = moment(selectedStart);
		const selectedEndMoment = moment(selectedEnd);
		const timeLogStartMoment = moment(timeLogStart);
		const timeLogEndMoment = moment(timeLogEnd);

		// Calculate the overlap based on time boundaries
		if (timeLogStartMoment.isBetween(selectedStartMoment, selectedEndMoment)) {
			if (timeLogEndMoment.isBetween(selectedStartMoment, selectedEndMoment)) {
				return timeLogEndMoment.diff(timeLogStartMoment, 'seconds');
			} else {
				return selectedEndMoment.diff(timeLogStartMoment, 'seconds');
			}
		} else if (timeLogEndMoment.isBetween(selectedStartMoment, selectedEndMoment)) {
			return timeLogEndMoment.diff(selectedStartMoment, 'seconds');
		} else {
			return selectedEndMoment.diff(selectedStartMoment, 'seconds');
		}
	}

	/**
	 * Adds or updates a time log based on the current mode ('create' or 'update').
	 *
	 * - Validates the form, constructs the payload with the necessary details, and
	 *   interacts with the timesheet service to add or update the time log.
	 * - Resets the form and displays appropriate success or error messages.
	 *
	 * @returns {Promise<void>} - Resolves after the time log is added or updated.
	 */
	async addTime(): Promise<void> {
		if (this.loading || this.isButtonDisabled) return;

		try {
			this.loading = true;

			// Extract necessary data from the store and the form
			const { employee } = this._store.user;
			const { id: organizationId, tenantId } = this.organization;
			const { start, end } = this.selectedRange;

			const startedAt = toUTC(start).toDate();
			const stoppedAt = toUTC(end).toDate();

			// Construct the payload for time log
			const payload = {
				...omit(this.form.value, ['selectedRange']),
				startedAt,
				stoppedAt,
				organizationId,
				tenantId,
				logType: TimeLogType.MANUAL,
				source: TimeLogSourceEnum.WEB_TIMER,
				employeeId: this.form.value.employeeId || employee?.id // Fallback to current employee ID
			};

			// Create or update the time log based on the mode
			const timeLog =
				this.mode === 'create'
					? await this._timesheetService.addTime(payload)
					: await this._timesheetService.updateTime(this.timeLog.id, payload);

			// Close the dialog and reset the form
			this._dialogRef.close(timeLog);
			this.form.reset();
			this.selectedRange = { start: null, end: null };

			// Show success notification
			this._toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
		} catch (error) {
			// Handle errors and show error notification
			this._toastrService.error('Error: Unable to add time');
		} finally {
			// Reset the loading state
			this.loading = false;
		}
	}

	/**
	 * Confirms and deletes a time log if it is not currently running.
	 *
	 * @param timeLog - The time log object that needs to be deleted.
	 * @returns void - Exits early if the time log is still running.
	 */
	async onDeleteConfirm(timeLog: ITimeLog): Promise<void> {
		// Exit early if the user lacks delete permission or if the time log is running.
		if (!this._store.hasPermission(PermissionsEnum.ALLOW_DELETE_TIME) || timeLog.isRunning) {
			return;
		}

		// Extract employee from the time log and organization details.
		const employee = timeLog.employee;
		const { id: organizationId, name } = this.organization;

		// Prepare the request object for deleting logs.
		const request = {
			logIds: [timeLog.id],
			organizationId
		};

		try {
			// Await the service call to delete logs.
			const res = await this._timesheetService.deleteLogs(request);

			// Show a success message with employee name and organization.
			this._toastrService.success('TOASTR.MESSAGE.TIME_LOG_DELETED', {
				name: employee.fullName,
				organization: name
			});

			// Close the dialog after successful deletion.
			this._dialogRef.close(res);
		} catch (error) {
			// Optionally handle any errors (e.g., show an error message).
			console.error('Error deleting time log:', error);
			this._toastrService.error('TOASTR.MESSAGE.ERROR_DELETING_TIME_LOG');
		}
	}

	/**
	 * Retrieves the value of a form control by its name.
	 *
	 * @param control - The name of the form control whose value is to be retrieved.
	 * @returns string - The value of the form control. If the control is not found or the value is null, an empty string is returned.
	 */
	getControlValue(control: string): string {
		// Retrieve the form control using the given control name.
		const formControl = this.form.get(control);

		// If the control exists, return its value. Otherwise, return an empty string.
		return formControl ? formControl.value : '';
	}

	isValidSelectedRange(selectedRange: IDateRange) {
		const { start, end } = selectedRange;
		const startMoment = moment(start);
		const endMoment = moment(end);

		if (startMoment.isValid() && endMoment.isValid()) {
			return true;
		} else {
			return false;
		}
	}

	get isButtonDisabled(): boolean {
		return (
			this.form.invalid ||
			!this.isValidSelectedRange(this.selectedRange) ||
			this.overlaps?.length > 0 ||
			!this.isTimeRangeValid
		);
	}

	ngOnDestroy(): void {
		if (this.selectedRangeSubscription) {
			this.selectedRangeSubscription.unsubscribe();
		}
	}
}

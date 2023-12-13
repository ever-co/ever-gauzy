import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { IEmployee, IOrganization, IScreenshot, ITimeLog, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty, progressStatus, toLocal } from '@gauzy/common-angular';
import { sortBy } from 'underscore';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TimeLogsLabel } from './../../../../@core/constants';
import { TimesheetService } from '../../timesheet.service';
import { ViewTimeLogModalComponent } from '../../view-time-log-modal';
import { Store, ToastrService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-screenshots-modal',
	templateUrl: './view-screenshots-modal.component.html',
	styleUrls: ['./view-screenshots-modal.component.scss']
})
export class ViewScreenshotsModalComponent implements OnInit {
	progressStatus = progressStatus;
	TimeLogsLabel = TimeLogsLabel;
	PermissionsEnum = PermissionsEnum;
	private organization: IOrganization;

	/*
	* Getter & Setter for TimeSlot element
	*/
	private _timeSlot: ITimeSlot;
	get timeSlot(): ITimeSlot {
		return this._timeSlot;
	}
	/**
	 * Setter for the timeSlot property. Assigns the provided timeSlot value, processes
	 * and formats the screenshots, and updates the local _timeSlot property accordingly.
	 *
	 * @param timeSlot - The TimeSlot object to be assigned.
	 */
	@Input() set timeSlot(timeSlot: ITimeSlot) {
		if (timeSlot) {
			// Destructure the timeSlot object
			const { ...restTimeSlot } = timeSlot;
			const screenshots = JSON.parse(JSON.stringify(timeSlot.screenshots));

			// Process and format the screenshots array
			this.screenshots = sortBy(screenshots, 'recordedAt').map((screenshot: IScreenshot) => ({
				employee: timeSlot.employee,
				...screenshot
			}));

			// Update the _timeSlot object with formatted timestamps and other properties
			this._timeSlot = {
				...restTimeSlot,
				localStartedAt: toLocal(timeSlot.startedAt).toDate(),
				localStoppedAt: toLocal(timeSlot.stoppedAt).toDate()
			};
		}
	}

	/*
	* Getter & Setter for Screenshots
	*/
	private _screenshots: IScreenshot[] = [];
	get screenshots(): IScreenshot[] {
		return this._screenshots;
	}
	set screenshots(screenshots: IScreenshot[]) {
		this._screenshots = screenshots;
	}

	/*
	* Getter & Setter for Screenshots
	*/
	private _timeLogs: ITimeLog[] = [];
	get timeLogs(): ITimeLog[] {
		return this._timeLogs;
	}
	@Input() set timeLogs(timeLogs: ITimeLog[]) {
		this._timeLogs = sortBy(timeLogs, 'recordedAt');
	}

	/**
	 * Array to store unique application names associated with the current time slot.
	 * Used in the context of time logs and screenshots.
	 */
	apps: string[] = [];

	constructor(
		private readonly store: Store,
		private readonly dialogRef: NbDialogRef<ViewScreenshotsModalComponent>,
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly toastrService: ToastrService
	) { }

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.getTimeSlot()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Asynchronously retrieves and sets the time slot and associated time logs.
	 *
	 * @returns A Promise that resolves when the operation is complete.
	 */
	async getTimeSlot(): Promise<void> {
		try {
			// Check if organization and time slot are available
			if (!this.organization || !this.timeSlot) {
				return;
			}

			// Retrieve time slot with specified relations
			this.timeSlot = await this.timesheetService.getTimeSlot(this.timeSlot.id, {
				relations: [
					'employee.user',
					'screenshots',
					'timeLogs.project',
					'timeLogs.task',
					'timeLogs.organizationContact',
					'timeLogs.employee.user',
				],
			});

			// Set the time logs property to the time logs of the retrieved time slot
			this.timeLogs = this.timeSlot.timeLogs;

			// Retrieve and set unique apps from the screenshots of the time slot
			this.apps = this.getScreenshotUniqueApps() || [];
		} catch (error) {
			// Handle errors by logging and displaying a toastr message
			console.error('Error while retrieving TimeSlot:', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * Closes the current dialog.
	 */
	close(): void {
		this.dialogRef.close();
	}

	/**
	 * Opens a modal to view details of a time log.
	 *
	 * @param timeLog - The time log to be viewed.
	 */
	viewTimeLog(timeLog: ITimeLog): void {
		this.nbDialogService.open(ViewTimeLogModalComponent, {
			context: { timeLog },
		});
	}

	/**
	 * Deletes a specific screenshot associated with an employee.
	 *
	 * @param screenshot - The screenshot to be deleted.
	 * @param employee - The employee associated with the screenshot.
	 * @returns void
	 */
	async deleteImage(screenshot: IScreenshot, employee: IEmployee): Promise<void> {
		if (!screenshot || !this.organization) {
			return;
		}

		try {
			const { name } = this.organization;
			const { organizationId, tenantId } = screenshot;

			// Delete the specified screenshot
			await this.timesheetService.deleteScreenshot(screenshot.id, {
				organizationId,
				tenantId
			});

			// Remove the deleted screenshot from the local collection
			this.screenshots = this.screenshots.filter(
				(item: IScreenshot) => item.id !== screenshot.id
			);

			// Display success message
			this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
				name: employee.fullName,
				organization: name
			});
		} catch (error) {
			// Handle errors by logging and displaying a toastr message
			console.error('Error while deleting screenshot:', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * Deletes a specific time log associated with an employee.
	 *
	 * @param timeLog - The time log to be deleted.
	 * @param employee - The employee associated with the time log.
	 * @returns void
	 */
	async deleteTimeLog(timeLog: ITimeLog, employee: IEmployee): Promise<void> {
		if (timeLog.isRunning) {
			return;
		}

		try {
			const { id: organizationId, name: organizationName } = this.organization;
			const request = {
				logIds: [timeLog.id],
				organizationId
			};

			// Delete the specified time log
			await this.timesheetService.deleteLogs(request);

			// Display success message
			this.toastrService.success('TOASTR.MESSAGE.TIME_LOG_DELETED', {
				name: employee.fullName,
				organization: organizationName
			});

			// Close the dialog and emit an event indicating time log deletion
			this.dialogRef.close({
				timeLog: timeLog,
				isDelete: true
			});
		} catch (error) {
			// Handle errors by logging and displaying a toastr message
			console.error('Error while deleting TimeLog:', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * Extracts unique applications from an array of screenshots,
	 * handling the possibility of 'apps' being a string or an array.
	 *
	 * @returns An array containing unique application names.
	 */
	public getScreenshotUniqueApps(): string[] {
		// Use a Set to automatically handle uniqueness
		const uniqueAppsSet = new Set<string>();

		if (isNotEmpty(this.screenshots)) {
			// Iterate through each screenshot to collect unique apps
			this.screenshots.forEach((screenshot: IScreenshot) => {
				// Determine the format of 'apps' property and convert if needed
				const apps: string | string[] = screenshot.apps;
				const screenshotApps = Array.isArray(apps) ? apps : this.parseApps(apps);

				if (isNotEmpty(screenshotApps)) {
					// Add each app to the Set to ensure uniqueness
					screenshotApps.forEach((app) => {
						uniqueAppsSet.add(app);
					});
				}
			});
		}

		// Convert the Set back to an array for the final result
		return Array.from(uniqueAppsSet);
	}

	/**
	 * Parses a string representation of applications as JSON,
	 * returning the parsed array or an empty array if parsing fails.
	 *
	 * @param apps The string or array representation of applications.
	 * @returns An array of application names.
	 * @private
	 */
	private parseApps(apps: string | string[]): string[] {
		if (typeof apps === 'string') {
			try {
				return JSON.parse(apps);
			} catch (error) {
				// Return an empty array if parsing fails
				return [];
			}
		}
		// If 'apps' is already an array, return it as is
		return apps;
	}
}

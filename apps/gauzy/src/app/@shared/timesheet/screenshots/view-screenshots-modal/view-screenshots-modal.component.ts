import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { IEmployee, IOrganization, IScreenshot, ITimeLog, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { progressStatus, toLocal } from '@gauzy/common-angular';
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
	@Input() set timeSlot(timeSlot: ITimeSlot) {
		let screenshots = JSON.parse(JSON.stringify(timeSlot.screenshots));
		this.screenshots = sortBy(screenshots, 'createdAt').map((screenshot: IScreenshot) => {
			return {
				employee: timeSlot.employee,
				...screenshot
			}
		});
		this._timeSlot = Object.assign({}, timeSlot, {
			localStartedAt: toLocal(timeSlot.startedAt).toDate(),
			localStoppedAt: toLocal(timeSlot.stoppedAt).toDate()
		});
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
		this._timeLogs = sortBy(timeLogs, 'createdAt');
	}
	constructor(
		private readonly store: Store,
		private readonly dialogRef: NbDialogRef<ViewScreenshotsModalComponent>,
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly toastrService: ToastrService
	) {}

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

	async getTimeSlot() {
		try {
			this.timeSlot = await this.timesheetService.getTimeSlot(this.timeSlot.id, {
				relations: [
					'employee.user',
					'screenshots',
					'timeLogs',
					'timeLogs.project',
					'timeLogs.task',
					'timeLogs.organizationContact',
					'timeLogs.employee.user',
				]
			});
			this.timeLogs = this.timeSlot.timeLogs;
		} catch (error) {
			console.log('Error while retrieve TimeSlot:', error);
			this.toastrService.danger(error);
		}
	}

	close() {
		this.dialogRef.close();
	}

	viewTimeLog(timeLog: ITimeLog) {
		this.nbDialogService.open(ViewTimeLogModalComponent, {
			context: { timeLog }
		});
	}

	/**
	 * DELETE specific Screenshot
	 *
	 * @param screenshot
	 * @param employee
	 * @returns
	 */
	async deleteImage(
		screenshot: IScreenshot,
		employee: IEmployee
	) {
		if (!screenshot || !this.organization) {
			return;
		}
		try {
			const { name } = this.organization;
			const { organizationId, tenantId } = screenshot;

			await this.timesheetService.deleteScreenshot(screenshot.id, {
				organizationId,
				tenantId
			}).then(() => {
				this.screenshots = this.screenshots.filter(
					(item: IScreenshot) => item.id !== screenshot.id
				);
			});
			this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
				name: employee.fullName,
				organization: name
			});
		} catch (error) {
			console.log('Error while delete screenshot: ', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * DELETE specific TimeLog
	 *
	 * @param timeLog
	 */
	async deleteTimeLog(timeLog: ITimeLog, employee: IEmployee) {
		if (timeLog.isRunning) {
			return;
		}
		try {
			const { id: organizationId } = this.organization;
			const request = {
				logIds: [timeLog.id],
				organizationId
			}
			await this.timesheetService.deleteLogs(request).then(() => {
				this.toastrService.success('TOASTR.MESSAGE.TIME_LOG_DELETED', {
					name: employee.fullName,
					organization: this.organization.name
				});
				this.dialogRef.close({
					timeLog: timeLog,
					isDelete: true
				});
			});
		} catch (error) {
			console.log('Error while delete TimeLog: ', error);
			this.toastrService.danger(error);
		}
	}
}

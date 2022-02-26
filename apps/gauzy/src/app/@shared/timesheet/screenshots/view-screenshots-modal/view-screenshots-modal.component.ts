import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { IOrganization, IScreenshot, ITimeLog, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { progressStatus, toLocal } from '@gauzy/common-angular';
import * as _ from 'underscore';
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
		timeSlot.localStartedAt = toLocal(timeSlot.startedAt).toDate();
		timeSlot.localStoppedAt = toLocal(timeSlot.stoppedAt).toDate();
		this._timeSlot = timeSlot;

		this.screenshots = _.sortBy(JSON.parse(JSON.stringify(timeSlot.screenshots)), 'createdAt').reverse();
	}

	/*
	* Getter & Setter for Screenshots element
	*/
	private _screenshots: IScreenshot[] = [];
	public get screenshots(): IScreenshot[] {
		return this._screenshots;
	}
	public set screenshots(screenshots: IScreenshot[]) {
		this._screenshots = screenshots;
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
					'timeLogs',
					'screenshots',
					'timeLogs.employee',
					'timeLogs.employee.user',
					'timeLogs.project',
					'timeLogs.task',
					'timeLogs.organizationContact'
				]
			});
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
	 */
	async deleteImage(
		screenshot: IScreenshot,
		timeLogs: ITimeLog[]
	) {
		if (!screenshot) {
			return;
		}
		try {
			const employee = timeLogs[0]['employee'];
			await this.timesheetService.deleteScreenshot(screenshot.id).then(() => {
				this.screenshots = this.screenshots.filter(
					(item: IScreenshot) => item.id !== screenshot.id
				);
			});
			this.toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
				name: employee.fullName,
				organization: this.organization.name
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
	async deleteTimeLog(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		try {
			await this.timesheetService.deleteLogs(timeLog.id);
		} catch (error) {
			console.log('Error while delete TimeLog: ', error);
			this.toastrService.danger(error);
		}
	}
}

import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { IScreenshot, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { progressStatus } from '@gauzy/common-angular';
import { TimeLogsLabel } from './../../../../@core/constants/timesheet.constants';
import { TimesheetService } from '../../timesheet.service';
import { ViewTimeLogModalComponent } from '../../view-time-log-modal/view-time-log-modal/view-time-log-modal.component';
import * as _ from 'underscore';

@Component({
	selector: 'ngx-view-screenshots-modal',
	templateUrl: './view-screenshots-modal.component.html',
	styleUrls: ['./view-screenshots-modal.component.scss']
})
export class ViewScreenshotsModalComponent implements OnInit {
	progressStatus = progressStatus;
	TimeLogsLabel = TimeLogsLabel;
	PermissionsEnum = PermissionsEnum;
	@Input() timeSlot: ITimeSlot;

	private _screenshots: IScreenshot[] = [];
	public get screenshots(): IScreenshot[] {
		return this._screenshots;
	}
	public set screenshots(screenshots: IScreenshot[]) {
		this._screenshots = screenshots;
	}

	constructor(
		private dialogRef: NbDialogRef<ViewScreenshotsModalComponent>,
		private timesheetService: TimesheetService,
		private nbDialogService: NbDialogService
	) {}

	ngOnInit(): void {
		this.getTimeSlot();
	}

	getTimeSlot() {
		this.timesheetService
			.getTimeSlot(this.timeSlot.id, {
				relations: [
					'timeLogs',
					'screenshots',
					'timeLogs.employee',
					'timeLogs.employee.user',
					'timeLogs.project',
					'timeLogs.task',
					'timeLogs.organizationContact'
				]
			})
			.then((timeSlot) => {
				this.timeSlot = timeSlot;
				const screenshots = JSON.parse(
					JSON.stringify(timeSlot.screenshots)
				);
				this.screenshots = _.sortBy(screenshots, 'createdAt').reverse();
			});
	}

	close() {
		this.dialogRef.close();
	}

	viewTimeLog(timeLog) {
		this.nbDialogService.open(ViewTimeLogModalComponent, {
			context: { timeLog }
		});
	}
}

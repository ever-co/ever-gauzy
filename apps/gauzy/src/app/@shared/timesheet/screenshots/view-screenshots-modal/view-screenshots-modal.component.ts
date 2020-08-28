import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TimeSlot, PermissionsEnum } from '@gauzy/models';
import { prgressStatus } from 'libs/utils';
import { TimeLogsLable } from 'apps/gauzy/src/app/static-data/timesheet';
import { TimesheetService } from '../../timesheet.service';
import { ViewTimeLogModalComponent } from '../../view-time-log-modal/view-time-log-modal/view-time-log-modal.component';

@Component({
	selector: 'ngx-view-screenshots-modal',
	templateUrl: './view-screenshots-modal.component.html',
	styleUrls: ['./view-screenshots-modal.component.scss']
})
export class ViewScreenshotsModalComponent implements OnInit {
	prgressStatus = prgressStatus;
	TimeLogsLable = TimeLogsLable;
	PermissionsEnum = PermissionsEnum;
	@Input() timeSlot: TimeSlot;

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
				console.log(this.timeSlot);
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

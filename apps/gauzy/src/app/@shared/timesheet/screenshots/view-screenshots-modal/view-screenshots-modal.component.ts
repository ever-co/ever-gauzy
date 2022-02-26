import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { IScreenshot, ITimeLog, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { progressStatus, toLocal } from '@gauzy/common-angular';
import * as _ from 'underscore';
import { TimeLogsLabel } from './../../../../@core/constants';
import { TimesheetService } from '../../timesheet.service';
import { ViewTimeLogModalComponent } from '../../view-time-log-modal';
import { ToastrService } from './../../../../@core/services';

@Component({
	selector: 'ngx-view-screenshots-modal',
	templateUrl: './view-screenshots-modal.component.html',
	styleUrls: ['./view-screenshots-modal.component.scss']
})
export class ViewScreenshotsModalComponent implements OnInit {
	progressStatus = progressStatus;
	TimeLogsLabel = TimeLogsLabel;
	PermissionsEnum = PermissionsEnum;

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
		private readonly dialogRef: NbDialogRef<ViewScreenshotsModalComponent>,
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly toastrService: ToastrService
	) {}

	ngOnInit(): void {
		this.getTimeSlot();
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
   *
   * @param image
   */
  deleteImage(image){
    //!!To do: implement logic
  }
  /**
   * delete time slot
   */
  async deleteTimeSlot(){
     //!!To do: implement logic
  }
}

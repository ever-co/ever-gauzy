import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { IDateRange, Organization, TimeLog } from '@gauzy/models';
import { toUTC } from 'libs/utils';
import { TimesheetService } from '../timesheet.service';
import { NgForm } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Component({
	selector: 'ngx-edit-time-log-modal',
	templateUrl: './edit-time-log-modal.component.html',
	styleUrls: ['./edit-time-log-modal.component.scss']
})
export class EditTimeLogModalComponent implements OnInit, OnDestroy {
	today: Date = new Date();

	addEditRequest: any = {
		isBillable: true,
		projectId: null,
		taskId: null,
		description: ''
	};
	selectedRange: IDateRange = { start: null, end: null };
	organization: Organization;

	@Input()
	private _timeLog: TimeLog;
	public get timeLog(): TimeLog {
		return this._timeLog;
	}
	public set timeLog(value: TimeLog) {
		this.addEditRequest = Object.assign({}, value);
		this._timeLog = value;
	}

	constructor(
		private timesheetService: TimesheetService,
		private store: Store,
		private dialogRef: NbDialogRef<EditTimeLogModalComponent>
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
			});
	}

	close() {
		this.dialogRef.close(null);
	}

	addTime(f: NgForm) {
		if (!f.valid) {
			return;
		}
		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();

		const addRequestData = {
			startedAt,
			stoppedAt,
			isBillable: this.addEditRequest.isBillable,
			projectId: this.addEditRequest.projectId,
			taskId: this.addEditRequest.taskId,
			description: this.addEditRequest.description
		};

		(this.addEditRequest.id
			? this.timesheetService.updateTime(
					this.addEditRequest.id,
					addRequestData
			  )
			: this.timesheetService.addTime(addRequestData)
		)
			.then((data) => {
				f.resetForm();
				this.dialogRef.close(data);
				this.selectedRange = { start: null, end: null };
			})
			.catch((error) => {
				this.dialogRef.close(error);
			});
	}

	ngOnDestroy(): void {}
}

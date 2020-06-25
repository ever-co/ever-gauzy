import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { GoalTimeFrame, TimeFrameStatusEnum } from '@gauzy/models';
import {
	getQuarter,
	startOfQuarter,
	endOfQuarter,
	getYear,
	lastDayOfQuarter,
	addDays,
	startOfYear,
	endOfYear
} from 'date-fns';

@Component({
	selector: 'ga-edit-time-frame',
	templateUrl: './edit-time-frame.component.html',
	styleUrls: ['./edit-time-frame.component.scss']
})
export class EditTimeFrameComponent implements OnInit {
	timeFrameForm: FormGroup;
	timeFrame: GoalTimeFrame;
	today = new Date();
	type: string;
	predefinedTimeFrames = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	constructor(
		private dialogRef: NbDialogRef<EditTimeFrameComponent>,
		private fb: FormBuilder,
		private goalSettingsService: GoalSettingsService
	) {}

	ngOnInit() {
		this.timeFrameForm = this.fb.group({
			name: ['', Validators.required],
			status: [TimeFrameStatusEnum.ACTIVE, Validators.required],
			startDate: [null, Validators.required],
			endDate: [null, Validators.required]
		});
		if (!!this.timeFrame) {
			this.timeFrameForm.patchValue({
				name: this.timeFrame.name,
				status: this.timeFrame.status,
				startDate: new Date(this.timeFrame.startDate),
				endDate: new Date(this.timeFrame.endDate)
			});
		}

		this.generateTimeFrames();
	}

	updateTimeFrameValues(timeFrame, event) {
		event.stopPropagation();
		this.timeFrameForm.patchValue({
			name: !!timeFrame.name ? timeFrame.name : '',
			startDate: !!timeFrame.start ? new Date(timeFrame.start) : null,
			endDate: !!timeFrame.end ? new Date(timeFrame.end) : null,
			status: TimeFrameStatusEnum.ACTIVE
		});
		this.timeFrameForm.patchValue({ startDate: timeFrame.start });
		this.timeFrameForm.controls['startDate'].updateValueAndValidity();
	}

	generateTimeFrames() {
		const today = new Date();
		let date = today;
		// Add Quarters
		while (getYear(date) === getYear(today)) {
			this.predefinedTimeFrames.push({
				name: `Q${getQuarter(date)}-${getYear(date)}`,
				start: startOfQuarter(date),
				end: endOfQuarter(date)
			});
			date = addDays(lastDayOfQuarter(date), 1);
		}
		this.predefinedTimeFrames.push({
			name: `Annual-${getYear(today)}`,
			start: startOfYear(today),
			end: endOfYear(today)
		});
	}

	async saveTimeFrame() {
		if (this.type === 'add') {
			await this.goalSettingsService
				.createTimeFrame(this.timeFrameForm.value)
				.then((res) => {
					if (res) {
						this.closeDialog(res);
					}
				});
		} else {
			await this.goalSettingsService
				.update(this.timeFrame.id, this.timeFrameForm.value)
				.then((res) => {
					if (res) {
						this.closeDialog(res);
					}
				});
		}
	}

	closeDialog(val) {
		this.dialogRef.close(val);
	}
}

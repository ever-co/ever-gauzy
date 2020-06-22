import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { GoalTimeFrame } from '@gauzy/models';

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
	constructor(
		private dialogRef: NbDialogRef<EditTimeFrameComponent>,
		private fb: FormBuilder,
		private goalSettingsService: GoalSettingsService
	) {}

	ngOnInit() {
		this.timeFrameForm = this.fb.group({
			name: ['', Validators.required],
			status: ['active', Validators.required],
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

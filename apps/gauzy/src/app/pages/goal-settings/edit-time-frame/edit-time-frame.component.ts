import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDateService } from '@nebular/theme';
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
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-edit-time-frame',
	templateUrl: './edit-time-frame.component.html',
	styleUrls: ['./edit-time-frame.component.scss']
})
export class EditTimeFrameComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	timeFrameForm: FormGroup;
	timeFrame: GoalTimeFrame;
	today = new Date();
	type: string;
	predefinedTimeFrames = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogRef: NbDialogRef<EditTimeFrameComponent>,
		private fb: FormBuilder,
		private goalSettingsService: GoalSettingsService,
		private dateService: NbDateService<Date>,
		readonly translate: TranslateService
	) {
		super(translate);
	}

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
		this.timeFrameForm.valueChanges
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((form) => {
				if (form.startDate > form.endDate) {
					this.timeFrameForm.controls['endDate'].setErrors({
						invalid: true,
						beforeRequestDayMsg: this.getTranslation(
							'GOALS_PAGE.FORM.ERROR.START_DATE_GREATER'
						)
					});
				}
			});
		this.generateTimeFrames();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	updateTimeFrameValues(timeFrame, event) {
		event.stopPropagation();
		this.timeFrameForm.patchValue({
			name: !!timeFrame.name ? timeFrame.name : '',
			startDate: !!timeFrame.start
				? this.dateService.clone(timeFrame.start)
				: null,
			endDate: !!timeFrame.end
				? this.dateService.clone(timeFrame.end)
				: null,
			status: TimeFrameStatusEnum.ACTIVE
		});
	}

	generateTimeFrames() {
		const today = new Date();
		let date = today;
		// Add Quarters
		while (getYear(date) === getYear(today)) {
			this.predefinedTimeFrames.push({
				name: `Q${getQuarter(date)}-${getYear(date)}`,
				start: new Date(startOfQuarter(date)),
				end: new Date(endOfQuarter(date))
			});
			date = addDays(lastDayOfQuarter(date), 1);
		}
		this.predefinedTimeFrames.push({
			name: `Annual-${getYear(today)}`,
			start: new Date(startOfYear(today)),
			end: new Date(endOfYear(today))
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

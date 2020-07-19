import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDateService } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { GoalTimeFrame, TimeFrameStatusEnum } from '@gauzy/models';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-edit-time-frame',
	templateUrl: './edit-time-frame.component.html',
	styleUrls: ['./edit-time-frame.component.scss']
})
export class EditTimeFrameComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	timeFrameForm: FormGroup;
	timeFrame: GoalTimeFrame;
	type: string;
	predefinedTimeFrames = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogRef: NbDialogRef<EditTimeFrameComponent>,
		private fb: FormBuilder,
		private goalSettingsService: GoalSettingsService,
		private dateService: NbDateService<Date>,
		readonly translate: TranslateService,
		private store: Store
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

	async saveTimeFrame() {
		const data = {
			...this.timeFrameForm.value,
			organization: this.store.selectedOrganization.id
		};
		if (this.type === 'add') {
			await this.goalSettingsService.createTimeFrame(data).then((res) => {
				if (res) {
					this.closeDialog(res);
				}
			});
		} else {
			await this.goalSettingsService
				.updateTimeFrame(this.timeFrame.id, data)
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

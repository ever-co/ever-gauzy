import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDateService } from '@nebular/theme';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { IGoalTimeFrame, IOrganization, TimeFrameStatusEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	getYear,
	getQuarter,
	addDays,
	lastDayOfYear,
	startOfQuarter,
	endOfQuarter,
	lastDayOfQuarter,
	startOfYear,
	endOfYear
} from 'date-fns';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';
import { GoalSettingsService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-edit-time-frame',
    templateUrl: './edit-time-frame.component.html',
    styleUrls: ['./edit-time-frame.component.scss'],
    standalone: false
})
export class EditTimeFrameComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	timeFrameForm: UntypedFormGroup;
	timeFrame: IGoalTimeFrame;
	type: string;
	preDefinedTimeFrames = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	organization: IOrganization;

	constructor(
		private dialogRef: NbDialogRef<EditTimeFrameComponent>,
		private fb: UntypedFormBuilder,
		private goalSettingsService: GoalSettingsService,
		private dateService: NbDateService<Date>,
		readonly translate: TranslateService,
		private readonly toastrService: ToastrService,
		private store: Store
	) {
		super(translate);
	}

	ngOnInit() {
		this.organization = this.store.selectedOrganization;
		this.timeFrameForm = this.fb.group({
			name: ['', Validators.required],
			status: [TimeFrameStatusEnum.ACTIVE, Validators.required],
			startDate: [null, Validators.required],
			endDate: [null, Validators.required]
		});

		this.generateTimeFrames();

		if (!!this.timeFrame) {
			this.timeFrameForm.patchValue({
				name: this.timeFrame.name,
				status: this.timeFrame.status.text,
				startDate: new Date(this.timeFrame.startDate),
				endDate: new Date(this.timeFrame.endDate)
			});
		}
		this.timeFrameForm.valueChanges.pipe(untilDestroyed(this)).subscribe((form) => {
			if (form.startDate > form.endDate) {
				this.timeFrameForm.controls['endDate'].setErrors({
					invalid: true,
					beforeRequestDayMsg: this.getTranslation('GOALS_PAGE.FORM.ERROR.START_DATE_GREATER')
				});
			}
		});
	}

	generateTimeFrames() {
		const today = new Date();
		let date = today;
		let year = getYear(today);
		this.preDefinedTimeFrames = [];
		// Add Quarters
		if (getQuarter(date) > 2) {
			year = getYear(addDays(lastDayOfYear(today), 1));
		}
		while (getYear(date) <= year) {
			const timeFrameName = `Q${getQuarter(date)}-${getYear(date)}`;
			this.preDefinedTimeFrames.push({
				name: timeFrameName,
				start: new Date(startOfQuarter(date)),
				end: new Date(endOfQuarter(date))
			});
			date = addDays(lastDayOfQuarter(date), 1);
		}
		// Annual Time Frames
		this.preDefinedTimeFrames.push({
			name: `${this.getTranslation('GOALS_PAGE.SETTINGS.ANNUAL')}-${getYear(today)}`,
			start: new Date(startOfYear(today)),
			end: new Date(endOfYear(today))
		});
		if (year > getYear(today)) {
			this.preDefinedTimeFrames.push({
				name: `${this.getTranslation('GOALS_PAGE.SETTINGS.ANNUAL')}-${year}`,
				start: new Date(startOfYear(addDays(lastDayOfYear(today), 1))),
				end: new Date(endOfYear(addDays(lastDayOfYear(today), 1)))
			});
		}
	}

	ngOnDestroy() {}

	updateTimeFrameValues(timeFrame, event) {
		event.stopPropagation();
		this.timeFrameForm.patchValue({
			name: !!timeFrame.name ? timeFrame.name : '',
			startDate: !!timeFrame.start ? this.dateService.clone(timeFrame.start) : null,
			endDate: !!timeFrame.end ? this.dateService.clone(timeFrame.end) : null,
			status: TimeFrameStatusEnum.ACTIVE
		});
	}

	async saveTimeFrame() {
		const { id: organizationId, tenantId } = this.organization;
		const data = {
			...this.timeFrameForm.value,
			organizationId,
			tenantId
		};
		if (this.type === 'add') {
			await this.goalSettingsService.createTimeFrame(data).then((res) => {
				if (res) {
					this.toastrService.success('TOASTR.MESSAGE.TIME_FRAME_CREATED', {
						name: data.name
					});
					this.closeDialog(res);
				}
			});
		} else {
			await this.goalSettingsService.updateTimeFrame(this.timeFrame.id, data).then((res) => {
				if (res) {
					this.toastrService.success('TOASTR.MESSAGE.TIME_FRAME_UPDATED', {
						name: data.name
					});
					this.closeDialog(res);
				}
			});
		}
	}

	closeDialog(val) {
		this.dialogRef.close(val);
	}
}

import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import {
	IKeyResult,
	IKeyResultUpdate,
	KeyResultTypeEnum,
	KeyResultUpdateStatusEnum,
	IKPI,
	KpiOperatorEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { GoalSettingsService, KeyResultUpdateService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';

@Component({
	selector: 'ga-keyresult-update',
	templateUrl: './keyresult-update.component.html',
	styleUrls: ['./keyresult-update.component.scss']
})
export class KeyResultUpdateComponent extends TranslationBaseComponent implements OnInit {
	keyResultUpdateForm: UntypedFormGroup;
	keyResult: IKeyResult;
	KPI: IKPI;
	keyResultTypeEnum = KeyResultTypeEnum;
	hideStatus = false;
	updateStatusEnum = KeyResultUpdateStatusEnum;

	constructor(
		private dialogRef: NbDialogRef<KeyResultUpdateComponent>,
		private fb: UntypedFormBuilder,
		readonly translateService: TranslateService,
		private keyResultUpdateService: KeyResultUpdateService,
		private goalSettingsService: GoalSettingsService,
		private store: Store
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.keyResultUpdateForm = this.fb.group({
			newValueNumber: [null],
			newValueBoolean: [0],
			newStatus: [KeyResultUpdateStatusEnum.ON_TRACK]
		});
		this.keyResultUpdateForm.patchValue({
			newStatus: this.keyResult.status === 'none' ? KeyResultUpdateStatusEnum.ON_TRACK : this.keyResult.status
		});
		await this.getKPI();
		if (
			this.keyResult.type === KeyResultTypeEnum.NUMERICAL ||
			this.keyResult.type === KeyResultTypeEnum.CURRENCY ||
			this.keyResult.type === KeyResultTypeEnum.KPI
		) {
			this.keyResultUpdateForm.patchValue({
				newValueNumber: this.keyResult.update
			});
		} else if (this.keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
			this.hideStatus = true;
			this.keyResultUpdateForm.patchValue({
				newValueBoolean: this.keyResult.update === 1 ? true : false,
				newStatus: KeyResultUpdateStatusEnum.ON_TRACK
			});
		}
	}

	async getKPI() {
		await this.goalSettingsService
			.getAllKPI({
				organization: { id: this.store.selectedOrganization.id }
			})
			.then((kpi) => {
				const { items } = kpi;
				this.KPI = items.pop();
			});
	}

	closeDialog() {
		this.dialogRef.close();
	}

	async updateKeyResult() {
		if (this.keyResult.type === KeyResultTypeEnum.NUMERICAL || this.keyResult.type === KeyResultTypeEnum.CURRENCY) {
			this.keyResult.update = this.keyResultUpdateForm.value.newValueNumber;
			const diff = this.keyResult.targetValue - this.keyResult.initialValue;
			const updateDiff = this.keyResultUpdateForm.value.newValueNumber - this.keyResult.initialValue;
			this.keyResult.progress = Math.round((Math.abs(updateDiff) / Math.abs(diff)) * 100);
		} else if (this.keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
			this.keyResult.update = this.keyResultUpdateForm.value.newValueBoolean === true ? 1 : 0;
			this.keyResult.progress = this.keyResult.update === 0 ? 0 : 100;
		} else if (this.keyResult.type === KeyResultTypeEnum.KPI) {
			this.keyResult.update = this.keyResultUpdateForm.value.newValueNumber;
			if (this.KPI.operator === KpiOperatorEnum.LESSER_THAN_EQUAL_TO) {
				this.keyResult.progress = this.keyResult.update <= this.keyResult.targetValue ? 100 : 0;
			} else {
				this.keyResult.progress = this.keyResult.update >= this.keyResult.targetValue ? 100 : 0;
			}
		}
		this.keyResult.status = this.keyResultUpdateForm.value.newStatus;
		try {
			const update: IKeyResultUpdate = {
				keyResultId: this.keyResult.id,
				owner: this.keyResult.owner.id,
				update: this.keyResult.update,
				progress: this.keyResult.progress,
				status: this.keyResult.status
			};
			delete this.keyResult.updates;
			await this.keyResultUpdateService.createUpdate(update).then(async (res) => {
				if (res) {
					this.dialogRef.close(this.keyResult);
				}
			});
		} catch (error) {
			console.log(error);
		}
	}
}

import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder } from '@angular/forms';
import { KeyResult, KeyResultUpdates } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { KeyResultUpdateService } from '../../../@core/services/keyresult-update.service';

@Component({
	selector: 'ga-keyresult-update',
	templateUrl: './keyresult-update.component.html',
	styleUrls: ['./keyresult-update.component.scss']
})
export class KeyResultUpdateComponent extends TranslationBaseComponent
	implements OnInit {
	keyResultUpdateForm: FormGroup;
	keyResult: KeyResult;
	constructor(
		private dialogRef: NbDialogRef<KeyResultUpdateComponent>,
		private fb: FormBuilder,
		readonly translateService: TranslateService,
		private keyResultUpdateService: KeyResultUpdateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.keyResultUpdateForm = this.fb.group({
			newValueNumber: [null],
			newValueBoolean: [0],
			newStatus: ['none']
		});
		this.keyResultUpdateForm.patchValue({
			newStatus: this.keyResult.status
		});
		if (
			this.keyResult.type === 'Number' ||
			this.keyResult.type === 'Currency'
		) {
			this.keyResultUpdateForm.patchValue({
				newValueNumber: this.keyResult.update
			});
		} else if (this.keyResult.type === 'True/False') {
			this.keyResultUpdateForm.patchValue({
				newValueBoolean: this.keyResult.update === 1 ? true : false
			});
		}
	}

	closeDialog() {
		this.dialogRef.close();
	}

	async updateKeyResult() {
		if (
			this.keyResult.type === 'Number' ||
			this.keyResult.type === 'Currency'
		) {
			this.keyResult.update = this.keyResultUpdateForm.value.newValueNumber;
			const diff =
				this.keyResult.targetValue - this.keyResult.initialValue;
			const updateDiff =
				this.keyResultUpdateForm.value.newValueNumber -
				this.keyResult.initialValue;
			this.keyResult.progress = Math.round(
				(Math.abs(updateDiff) / Math.abs(diff)) * 100
			);
		} else if (this.keyResult.type === 'True/False') {
			this.keyResult.update =
				this.keyResultUpdateForm.value.newValueBoolean === true ? 1 : 0;
			this.keyResult.progress = this.keyResult.update === 0 ? 0 : 100;
		}
		this.keyResult.status = this.keyResultUpdateForm.value.newStatus;
		try {
			const update: KeyResultUpdates = {
				keyResultId: this.keyResult.id,
				owner: this.keyResult.owner,
				update: this.keyResult.update,
				progress: this.keyResult.progress,
				status: this.keyResult.status
			};
			delete this.keyResult.updates;
			await this.keyResultUpdateService
				.createUpdate(update)
				.then(async (res) => {
					if (res) {
						this.dialogRef.close(this.keyResult);
					}
				});
		} catch (error) {
			console.log(error);
		}
	}
}

import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	KeyResultTypeEnum,
	KeyResult,
	KeyResultWeightEnum
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { KeyResultService } from '../../../@core/services/keyresult.service';

@Component({
	selector: 'ga-key-result-parameters',
	templateUrl: './key-result-parameters.component.html'
})
export class KeyResultParametersComponent implements OnInit {
	weightForm: FormGroup;
	typeForm: FormGroup;
	data: KeyResult;
	keyResultTypeEnum = KeyResultTypeEnum;
	keyResultWeightEnum = KeyResultWeightEnum;
	constructor(
		private fb: FormBuilder,
		private dialogRef: NbDialogRef<KeyResultParametersComponent>,
		private keyResultService: KeyResultService
	) {}

	ngOnInit(): void {
		this.weightForm = this.fb.group({
			weight: [KeyResultWeightEnum.DEFAULT, Validators.required]
		});
		this.typeForm = this.fb.group({
			type: [KeyResultTypeEnum.NUMBER, Validators.required],
			targetValue: [1],
			initialValue: [0]
		});

		if (!!this.data) {
			this.typeForm.patchValue({
				type: this.data.type,
				targetValue: this.data.targetValue,
				initialValue: this.data.initialValue
			});
			this.weightForm.patchValue({
				weight: this.data.weight
			});
		}
	}

	updateKeyResult() {
		this.data.type = this.typeForm.value.type;
		this.data.targetValue = this.typeForm.value.targetValue;
		this.data.initialValue = this.typeForm.value.initialValue;
		this.data.weight = this.weightForm.value.weight;
		this.keyResultService.update(this.data.id, {
			...this.data
		});
		this.closeDialog();
	}

	closeDialog() {
		this.dialogRef.close();
	}
}

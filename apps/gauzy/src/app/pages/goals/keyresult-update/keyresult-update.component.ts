import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder } from '@angular/forms';
import { KeyResult } from '@gauzy/models';

@Component({
	selector: 'ga-keyresult-update',
	templateUrl: './keyresult-update.component.html',
	styleUrls: ['./keyresult-update.component.scss']
})
export class KeyresultUpdateComponent implements OnInit {
	keyresultUpdateForm: FormGroup;
	keyResult: KeyResult;
	constructor(
		private dialogRef: NbDialogRef<KeyresultUpdateComponent>,
		private fb: FormBuilder
	) {}

	ngOnInit() {
		console.log(this.keyResult);
		this.keyresultUpdateForm = this.fb.group({
			newValueNumber: [null],
			newValueBoolean: [false],
			newStatus: ['none']
		});
		this.keyresultUpdateForm.patchValue({
			newStatus: this.keyResult.status
		});
		if (
			this.keyResult.type === 'Number' ||
			this.keyResult.type === 'Currency'
		) {
			this.keyresultUpdateForm.patchValue({
				newValueNumber: this.keyResult.update
			});
		} else if (this.keyResult.type === 'True/False') {
			this.keyresultUpdateForm.patchValue({
				newValueBoolean: this.keyResult.update
			});
		}
	}

	closeDialog() {
		this.dialogRef.close();
	}

	updateKeyResult() {
		console.log(this.keyresultUpdateForm.value);
		if (
			this.keyResult.type === 'Number' ||
			this.keyResult.type === 'Currency'
		) {
			this.keyResult.update = this.keyresultUpdateForm.value.newValueNumber;
			const diff =
				this.keyResult.targetValue - this.keyResult.initialValue;
			const updateDiff =
				this.keyresultUpdateForm.value.newValueNumber -
				this.keyResult.initialValue;
			this.keyResult.progress =
				(Math.abs(updateDiff) / Math.abs(diff)) * 100;
		} else if (this.keyResult.type === 'True/False') {
			this.keyResult.update = this.keyresultUpdateForm.value.newValueBoolean;
			this.keyResult.progress = this.keyResult.update === false ? 0 : 100;
		}
		this.keyResult.status = this.keyresultUpdateForm.value.newStatus;
		this.dialogRef.close(this.keyResult);
	}
}

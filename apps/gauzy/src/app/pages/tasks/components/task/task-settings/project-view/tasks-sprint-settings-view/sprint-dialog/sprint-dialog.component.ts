import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { OrganizationSprint } from '@gauzy/models';

const DEFAULTS = {
	name: 'Sprint',
	length: 7
};

@Component({
	selector: 'ngx-sprint-dialog',
	templateUrl: './sprint-dialog.component.html',
	styleUrls: ['./sprint-dialog.component.css']
})
export class SprintDialogComponent implements OnInit {
	@Input() action: 'create' | 'edit';
	@Input() sprintData?: OrganizationSprint;
	@Input() dialogRef?: any;
	form: FormGroup;
	private defaults = DEFAULTS;

	constructor(private fb: FormBuilder) {}

	ngOnInit(): void {
		this.initForm();
	}

	initForm(): void {
		this.form = this.fb.group({
			name: [
				this.sprintData?.name || this.defaults.name,
				Validators.required
			],
			goal: [this.sprintData?.goal || null],
			length: [
				this.sprintData?.length || this.defaults.length,
				Validators.required
			],
			startDate: [this.sprintData?.startDate || null],
			endDate: [this.sprintData?.endDate || null]
		});
	}

	save(): void {
		if (this.form.valid) {
			this.dialogRef.close({
				...this.sprintData,
				...this.form.value
			});
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}

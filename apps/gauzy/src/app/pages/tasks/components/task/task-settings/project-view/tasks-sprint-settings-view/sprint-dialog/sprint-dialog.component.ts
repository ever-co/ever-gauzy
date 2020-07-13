import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { OrganizationSprint } from '@gauzy/models';

@Component({
	selector: 'ngx-sprint-dialog',
	templateUrl: './sprint-dialog.component.html',
	styleUrls: ['./sprint-dialog.component.css']
})
export class SprintDialogComponent implements OnInit {
	@Input() action: 'create' | 'edit';
	@Input() test: any;
	@Input() sprintData?: OrganizationSprint;
	@Input() dialogRef?: any;
	form: FormGroup;

	constructor(private fb: FormBuilder) {}

	ngOnInit(): void {
		this.initForm();
	}

	initForm(): void {
		this.form = this.fb.group({
			name: [this.sprintData?.name || null, Validators.required],
			goal: [this.sprintData?.goal || null],
			startDate: [this.sprintData?.startDate || null],
			endDate: [this.sprintData?.endDate || null]
		});
	}

	save(): void {
		if (this.form.valid) {
			this.dialogRef.close(this.form.value);
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}

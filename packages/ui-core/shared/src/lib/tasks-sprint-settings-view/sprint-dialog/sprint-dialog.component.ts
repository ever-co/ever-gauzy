import { Component, OnInit, Input } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import moment from 'moment';
import { IOrganizationSprint } from '@gauzy/contracts';

const DEFAULTS = {
	name: 'Sprint',
	length: 14
};

@Component({
    selector: 'ngx-sprint-dialog',
    templateUrl: './sprint-dialog.component.html',
    styleUrls: ['./sprint-dialog.component.scss'],
    standalone: false
})
export class SprintDialogComponent implements OnInit {
	@Input() action: 'create' | 'edit';
	@Input() sprintData?: IOrganizationSprint;
	@Input() dialogRef?: any;
	@Input() options?: any = {
		sprintIndex: 0
	};
	form: UntypedFormGroup;
	private defaults = DEFAULTS;
	moment: any = moment;

	constructor(private fb: UntypedFormBuilder) {}

	ngOnInit(): void {
		this.initForm();
	}

	private generateSprintName(): any {
		if (this.action === 'create') {
			return [`${this.defaults.name} ${this.options.sprintIndex + 1}`, Validators.required];
		}
		return [this.sprintData?.name, Validators.required];
	}

	private generateSprintStartDate(): any {
		if (this.action === 'create' && !!this.options?.sprintStartDate) {
			return [moment(this.options.sprintStartDate).add(1, 'days').toDate()];
		}
		return [moment(this.sprintData?.startDate).toDate()];
	}

	private generateSprintEndDate(): any {
		if (this.action === 'create' && !!this.options?.sprintStartDate) {
			return [
				moment(moment(this.options.sprintStartDate))
					.add(this.sprintData?.length || this.defaults.length, 'days')
					.toDate()
			];
		}
		return [moment(this.sprintData?.endDate).add(this.defaults.length, 'days').toDate()];
	}

	initForm(): void {
		this.form = this.fb.group({
			name: this.generateSprintName(),
			goal: [this.sprintData?.goal],
			length: [this.sprintData?.length || this.defaults.length, Validators.required],
			startDate: this.generateSprintStartDate(),
			endDate: this.generateSprintEndDate()
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

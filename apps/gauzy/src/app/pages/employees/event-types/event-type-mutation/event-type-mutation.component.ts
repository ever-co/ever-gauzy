import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeSelectorComponent } from '../../../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { EventTypeViewModel } from '../event-type.component';
import { Tag } from '@gauzy/models';

export enum COMPONENT_TYPE {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION'
}

@Component({
	templateUrl: './event-type-mutation.component.html'
})
export class EventTypeMutationComponent extends TranslationBaseComponent
	implements OnInit {
	public form: FormGroup;
	tags: Tag[] = [];

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;
	eventType: EventTypeViewModel;
	durationUnits: string[] = ['Minute(s)', 'Hour(s)', 'Day(s)'];
	durationUnit: string = this.durationUnits[0];

	constructor(
		private fb: FormBuilder,
		public dialogRef: NbDialogRef<EventTypeMutationComponent>,
		private translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit() {
		this.durationUnits = ['Minute(s)', 'Hour(s)', 'Day(s)'];
		this._initializeForm();
	}

	submitForm() {
		if (this.form.valid) {
			this.closeAndSubmit();
		}
	}

	closeAndSubmit() {
		let formValues = this.form.getRawValue();
		formValues = {
			...formValues,
			startDay: formValues.startDate.getDate(),
			startMonth: formValues.startDate.getMonth(),
			startYear: formValues.startDate.getFullYear()
		};
		this.dialogRef.close(formValues);
	}

	onEmployeeChange(ev) {
		console.log(ev);
	}

	addOrEditEventType() {
		this.form.get('tags').setValue(this.tags);
		this.dialogRef.close(
			Object.assign(
				{
					employee: this.employeeSelector.selectedEmployee,
					id: this.eventType ? this.eventType.id : null
				},
				this.form.value
			)
		);
	}

	private _initializeForm() {
		if (this.eventType) {
			this.tags = this.eventType.tags;
		}
		this.form = this.fb.group({
			title: this.eventType ? this.eventType.title : '',
			description: this.eventType ? this.eventType.description : '',
			duration: this.eventType ? this.eventType.duration : undefined,
			durationUnit: this.eventType
				? this.eventType.durationUnit
				: this.durationUnits[0],
			isActive: this.eventType ? this.eventType.isActive : false,
			tags: []
		});
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}

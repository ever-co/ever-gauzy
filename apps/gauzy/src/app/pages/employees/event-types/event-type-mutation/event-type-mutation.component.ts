import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../../@core/services/store.service';
import { EmployeeSelectorComponent } from '../../../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { EventType } from '@gauzy/models';

export enum COMPONENT_TYPE {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION'
}

@Component({
	templateUrl: './event-type-mutation.component.html',
	styles: ['./event-type-mutation.component.scss']
})
export class EventTypeMutationComponent extends TranslationBaseComponent
	implements OnInit {
	public form: FormGroup;

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;
	eventType: EventType;
	durationUnits: string[] = ['Minute(s)', 'Hour(s)', 'Day(s)'];
	durationUnit: string = this.durationUnits[0];

	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<EventTypeMutationComponent>,
		private store: Store,
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

	addOrEditEventType() {
		this.dialogRef.close(
			Object.assign(
				{ employee: this.employeeSelector.selectedEmployee },
				this.form.value
			)
		);
	}

	private _initializeForm() {
		if (this.eventType) {
			this.form = this.fb.group({
				title: this.eventType.title,
				description: this.eventType.description,
				duration: this.eventType.duration,
				durationUnit: this.eventType.durationUnit,
				active: this.eventType.isActive
			});
		} else {
			this.form = this.fb.group({
				title: '',
				description: '',
				duration: undefined,
				durationUnit: this.durationUnits[0],
				active: false
			});
		}
	}
}

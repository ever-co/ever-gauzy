import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	KeyResultDeadlineEnum,
	GoalLevelEnum,
	KeyResultTypeEnum,
	KeyResultNumberUnitsEnum
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-goal-templates',
	templateUrl: './goal-templates.component.html',
	styleUrls: ['./goal-templates.component.scss']
})
export class GoalTemplatesComponent implements OnInit {
	goalTemplateForm: FormGroup;
	keyResultTemplateForm: FormGroup;
	goalLevelEnum = GoalLevelEnum;
	numberUnitsEnum: string[] = Object.values(KeyResultNumberUnitsEnum);
	keyResultTypeEnum = KeyResultTypeEnum;
	constructor(
		private fb: FormBuilder,
		private dialogRef: NbDialogRef<GoalTemplatesComponent>
	) {}

	ngOnInit(): void {
		this.goalTemplateForm = this.fb.group({
			goalName: ['', Validators.required],
			goalLevel: ['', Validators.required]
		});
		this.keyResultTemplateForm = this.fb.group({
			name: [''],
			type: [''],
			unit: [''],
			deadline: [KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE],
			hardDeadline: [null],
			softDeadline: [null]
		});
	}

	/* 
	createGoalTemplate() {
		const templateForm = {
			...this.goalTemplateForm.value,
			keyResult: {
				...this.keyResultTemplateForm.value
			}
		};
	}
    */
	closeDialog() {
		this.dialogRef.close();
	}
}

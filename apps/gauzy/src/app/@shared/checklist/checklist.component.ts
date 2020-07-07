import { Component, Input, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { Checklist } from '@gauzy/models';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

@Component({
	selector: 'ga-checklist',
	templateUrl: './checklist.component.html',
	styleUrls: ['./checklist.component.scss']
})
export class ChecklistComponent extends TranslationBaseComponent
	implements OnInit {
	checklist: Checklist[] = [];
	isTextBoxVisible = false;

	@Input() parentId;

	@Input() type;

	formGroup: FormGroup;

	checklistFormArray: FormArray;

	private _ngDestroy$ = new Subject<void>();

	constructor(
		readonly translationService: TranslateService,
		private fb: FormBuilder
	) {
		super(translationService);
	}

	ngOnInit() {
		this.checklistFormArray = this.fb.array([]);
		this.formGroup = this.fb.group({
			checklistName: [undefined, []],
			checklistFormArray: this.checklistFormArray
		});
	}

	getChecklistItemFormgroup(checklistItemName = undefined) {
		if (checklistItemName) {
			return this.fb.group({
				checklistItemName: [checklistItemName, []]
			});
		} else {
			return this.fb.group({
				checklistItemName: [undefined, []]
			});
		}
	}

	showTextBox() {
		this.isTextBoxVisible = true;
	}

	saveChecklist() {
		const formValues = this.formGroup.value;
		this.isTextBoxVisible = false;
		const checklist: Checklist = {
			name: formValues.checklistName,
			parentId: this.parentId,
			type: this.type,
			userId: '123',
			resolvedCount: 0,
			totalCount: this.checklist.length
		};
		this.checklist = [...this.checklist, checklist];
		this.formGroup.reset();
	}

	save() {
		console.log(this.formGroup);
	}

	cancel() {
		this.isTextBoxVisible = false;
		this.formGroup.reset();
	}

	addChecklistItem() {
		this.checklistFormArray.push(this.getChecklistItemFormgroup());
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

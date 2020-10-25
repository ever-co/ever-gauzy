import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import {
	JobMatchings,
	JobPostSourceEnum,
	MatchingCriterions
} from '@gauzy/models';

@Component({
	selector: 'gauzy-matching',
	templateUrl: './matching.component.html',
	styleUrls: ['./matching.component.scss']
})
export class MatchingComponent implements OnInit {
	presets: any[];
	criterionForm: FormGroup;
	JobPostSourceEnum = JobPostSourceEnum;
	keywords: string[] = [];
	categories: string[] = [];
	occupations: string[] = [];
	criterions: MatchingCriterions[] = [];

	constructor(private formBuilder: FormBuilder) {}

	ngOnInit(): void {}

	initForm(values: JobMatchings = {}): void {
		this.formBuilder.group({
			employeeId: [values.employeeId || null],
			jobSource: [values.jobSource || null],
			criterions: this.formBuilder.array([])
		});
	}

	addEditCriterion(criterion?: MatchingCriterions) {}

	deleteCriterions(index) {
		this.criterions.splice(index, 0);
	}

	createNewKeyword(title) {
		this.keywords.push(title);
	}

	createNewCategories(title) {
		this.categories.push(title);
	}

	createNewOccupations(title) {
		this.occupations.push(title);
	}
}

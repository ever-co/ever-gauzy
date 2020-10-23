import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import {
	JobMatchings,
	JobPostSourceEnum,
	MatchingCriterias
} from '@gauzy/models';

@Component({
	selector: 'gauzy-matching',
	templateUrl: './matching.component.html',
	styleUrls: ['./matching.component.scss']
})
export class MatchingComponent implements OnInit {
	presets: any[];
	form: FormGroup;
	JobPostSourceEnum = JobPostSourceEnum;
	keywords: string[] = [];
	categories: string[] = [];
	occupations: string[] = [];

	constructor(private formBulder: FormBuilder) {}

	ngOnInit(): void {
		this.initForm();
	}

	initForm(values: JobMatchings = {}): void {
		let i = 0;

		this.form = this.formBulder.group({
			employeeId: [values.employeeId || null],
			jobSource: [values.jobSource || null],
			criterias: this.formBulder.array([])
		});

		do {
			const criteria =
				values && values.criterias ? values.criterias[i] : {};
			this.addNewCriterias(criteria);
			i++;
		} while (values && values.criterias && values.criterias.length < i);
	}

	addNewCriterias(criteria: MatchingCriterias = {}) {
		const form = this.formBulder.group({
			keywords: [criteria.keywords],
			categories: [criteria.categories],
			occupations: [criteria.occupations],
			hourly: [criteria.hourly],
			fixPrice: [criteria.fixPrice]
		});
		this.criterias.push(form);
	}

	deleteCriteria(index) {
		this.criterias.removeAt(index);
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

	get criterias() {
		return this.form.get('criterias') as FormArray;
	}
}

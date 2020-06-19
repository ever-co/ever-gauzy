import {
	ICandidateTechnologies,
	ICandidatePersonalQualities
} from '@gauzy/models';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CandidatePersonalQualitiesService } from 'apps/gauzy/src/app/@core/services/candidate-personal-qualities.service';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { CandidateTechnologiesService } from 'apps/gauzy/src/app/@core/services/candidate-technologies.service';

@Component({
	selector: 'ga-candidate-criterions-form',
	templateUrl: 'candidate-criterions-form.component.html',
	styleUrls: ['candidate-criterions-form.component.scss']
})
export class CandidateCriterionsFormComponent implements OnInit, OnDestroy {
	@Input() editSelectedTechnologies: ICandidateTechnologies[];
	@Input() editSelectedQualities: ICandidatePersonalQualities[];
	form: any;
	technologiesList: ICandidateTechnologies[];
	personalQualitiesList: ICandidatePersonalQualities[];
	private _ngDestroy$ = new Subject<void>();
	selectedTechnologies = [];
	selectedQualities = [];
	checked: boolean;
	constructor(
		private readonly fb: FormBuilder,
		private candidateTechnologiesService: CandidateTechnologiesService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService
	) {}

	ngOnInit() {
		this.loadCriterions();
	}

	loadFormData() {
		this.form = this.fb.group({
			selectedTechnologies: [this.selectedTechnologies],
			selectedQualities: [this.selectedQualities]
		});
	}

	checkedTechnologies(value: string) {
		if (!this.selectedTechnologies.includes(value)) {
			this.selectedTechnologies.push(value);
		} else {
			this.selectedTechnologies.splice(
				this.selectedTechnologies.findIndex((item) => item === value),
				1
			);
		}
	}
	checkedQualities(value: string) {
		if (!this.selectedQualities.includes(value)) {
			this.selectedQualities.push(value);
		} else {
			this.selectedQualities.splice(
				this.selectedQualities.findIndex((item) => item === value),
				1
			);
		}
	}
	isChecked(id: string) {
		// TO DO: ids
		// this.editSelectedTechnologies.filter((item) => item.id === id);
		if (this.editSelectedTechnologies[0]) {
			for (const item of this.editSelectedTechnologies) {
				// 	if (item.id === id) {
				// 		return true;
				// 	}
			}
		}
	}
	private async loadCriterions() {
		const technologies = await this.candidateTechnologiesService.getAll();
		if (technologies) {
			this.technologiesList = technologies.items.filter(
				(item) => !item.interviewId
			);
		}
		const qualities = await this.candidatePersonalQualitiesService.getAll();
		if (qualities) {
			this.personalQualitiesList = qualities.items.filter(
				(item) => !item.interviewId
			);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

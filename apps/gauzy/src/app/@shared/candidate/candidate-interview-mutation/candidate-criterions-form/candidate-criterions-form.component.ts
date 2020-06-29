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
	@Input() editSelectedTechnologies: ICandidateTechnologies[] = [];
	@Input() editSelectedQualities: ICandidatePersonalQualities[] = [];
	form: any;
	technologiesList: ICandidateTechnologies[];
	personalQualitiesList: ICandidatePersonalQualities[];
	private _ngDestroy$ = new Subject<void>();
	selectedTechnologies = [];
	selectedQualities = [];
	checkedTech: number[] = [];
	checkedQual = [];
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
	private async loadCriterions() {
		const technologies = await this.candidateTechnologiesService.getAll();
		if (technologies) {
			this.technologiesList = technologies.items.filter(
				(item) => !item.interviewId
			);
			if (this.editSelectedTechnologies) {
				this.isChecked(
					this.editSelectedTechnologies,
					this.technologiesList,
					true
				);
			}
		}
		const qualities = await this.candidatePersonalQualitiesService.getAll();
		if (qualities) {
			this.personalQualitiesList = qualities.items.filter(
				(item) => !item.interviewId
			);
			if (this.editSelectedQualities) {
				this.isChecked(
					this.editSelectedQualities,
					this.personalQualitiesList,
					false
				);
			}
		}
	}
	isChecked(
		criterions: ICandidateTechnologies[] | ICandidatePersonalQualities[],
		allCriterions: ICandidateTechnologies[] | ICandidatePersonalQualities[],
		isTech: boolean
	) {
		const names = [];
		criterions.forEach((a) => {
			names.push(a.name);
		});
		allCriterions.forEach((itemCheck) => {
			names.includes(itemCheck.name)
				? isTech
					? this.checkedTech.push(1)
					: this.checkedQual.push(1)
				: isTech
				? this.checkedTech.push(0)
				: this.checkedQual.push(0);
		});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

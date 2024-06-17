import { ICandidateTechnologies, ICandidatePersonalQualities, IOrganization } from '@gauzy/contracts';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { UntypedFormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { Store } from '@gauzy/ui-core/common';
import { CandidatePersonalQualitiesService, CandidateTechnologiesService } from '@gauzy/ui-core/core';

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
	organization: IOrganization;
	constructor(
		private readonly fb: UntypedFormBuilder,
		private candidateTechnologiesService: CandidateTechnologiesService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		protected readonly store: Store
	) {}

	ngOnInit() {
		this.organization = this.store.selectedOrganization;
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
		const { id: organizationId, tenantId } = this.organization;
		const technologies = await this.candidateTechnologiesService.getAll({
			organizationId,
			tenantId
		});
		if (technologies) {
			this.technologiesList = technologies.items.filter((item) => !item.interviewId);
			if (this.editSelectedTechnologies) {
				this.isChecked(this.editSelectedTechnologies, this.technologiesList, true);
			}
		}
		const qualities = await this.candidatePersonalQualitiesService.getAll({
			organizationId,
			tenantId
		});
		if (qualities) {
			this.personalQualitiesList = qualities.items.filter((item) => !item.interviewId);
			if (this.editSelectedQualities) {
				this.isChecked(this.editSelectedQualities, this.personalQualitiesList, false);
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

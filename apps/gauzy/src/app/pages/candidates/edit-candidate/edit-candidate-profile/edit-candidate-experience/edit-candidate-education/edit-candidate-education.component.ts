import { Component } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html'
})
export class EditCandidateEducationComponent extends TranslationBaseComponent {
	educations: string[] = [];
	showAddCard: boolean;
	showEditDiv = [];
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	showEditCard(education: string, index: number) {
		this.showEditDiv[index] = true;
		this.showAddCard = !this.showAddCard;
	}
	removeEducation(index: number) {
		return this.educations.splice(index, 1);
	}
	/* editEducation(education: string, index: number) {
		this.educations[index] = education;
		this.showEditDiv[index] = !this.showEditDiv[index];
	}*/
	cancel(index: number) {
		this.showEditDiv[index] = !this.showEditDiv[index];
	}

	addEducation(education: string) {
		this.showAddCard = !this.showAddCard;
		if (education !== '') {
			this.educations.push(education);
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.CANDIDATE.EXPERIENCE.INVALID_CANDIDATE_NAME'
				),
				this.getTranslation('TOASTR.MESSAGE.CANDIDATE_SKILL_REQUIRED')
			);
		}
	}
}

import { Component } from '@angular/core';

export interface ICandidateSkill {
	name: string;
	candidateId: string;
}
@Component({
	selector: 'ga-edit-candidate-experience',
	template: `
		<nb-tabset fullWidth>
			<nb-tab
				tabTitle="{{
					'CANDIDATES_PAGE.EDIT_CANDIDATE.EDUCATION' | translate
				}}"
			>
				<ga-edit-candidate-education></ga-edit-candidate-education>
			</nb-tab>
			<nb-tab
				tabTitle="{{
					'CANDIDATES_PAGE.EDIT_CANDIDATE.EXPERIENCE' | translate
				}}"
			>
				<ga-edit-candidate-experience-form></ga-edit-candidate-experience-form>
			</nb-tab>
			<nb-tab
				tabTitle="{{
					'CANDIDATES_PAGE.EDIT_CANDIDATE.SKILLS' | translate
				}}"
			>
				<ga-edit-candidate-skills></ga-edit-candidate-skills>
			</nb-tab>
		</nb-tabset>
	`
})
export class EditCandidateExperienceComponent {}

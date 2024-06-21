import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbRadioModule,
	NbAccordionModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CandidateCriterionsRatingService,
	CandidatePersonalQualitiesService,
	CandidateTechnologiesService
} from '@gauzy/ui-core/core';
import { CandidateInterviewFeedbackComponent } from './candidate-interview-feedback.component';
import { StarRatingInputModule } from '../../star-rating/star-rating-input/star-rating-input.module';
import { CandidateSelectModule } from '../selectors/candidate-select/candidate-select.module';
import { StarRatingOutputModule } from '../../star-rating/star-rating-output/star-rating-output.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbInputModule,
		NbButtonModule,
		NbCardModule,
		NbRadioModule,
		NbIconModule,
		StarRatingInputModule,
		StarRatingOutputModule,
		CandidateSelectModule,
		NbAccordionModule,
		I18nTranslateModule.forChild()
	],
	exports: [CandidateInterviewFeedbackComponent],
	declarations: [CandidateInterviewFeedbackComponent],
	providers: [CandidateTechnologiesService, CandidatePersonalQualitiesService, CandidateCriterionsRatingService]
})
export class CandidateInterviewFeedbackModule {}

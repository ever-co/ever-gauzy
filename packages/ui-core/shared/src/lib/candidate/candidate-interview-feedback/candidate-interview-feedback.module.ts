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
import { TranslateModule } from '@ngx-translate/core';
import {
	CandidateCriterionsRatingService,
	CandidatePersonalQualitiesService,
	CandidateTechnologiesService
} from '@gauzy/ui-core/core';
import { CandidateInterviewFeedbackComponent } from './candidate-interview-feedback.component';
import { StarRatingInputModule } from '../../star-rating/star-rating-input/star-rating-input.module';
import { CandidateSelectModule } from '../selectors/candidate-select/candidate-select.module';
import { CandidateInterviewerSelectModule } from '../selectors/candidate-interviewer-select/candidate-interviewer-select.module';
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
		CandidateInterviewerSelectModule,
		NbAccordionModule,
		TranslateModule.forChild()
	],
	exports: [CandidateInterviewFeedbackComponent],
	declarations: [CandidateInterviewFeedbackComponent],
	providers: [CandidateTechnologiesService, CandidatePersonalQualitiesService, CandidateCriterionsRatingService]
})
export class CandidateInterviewFeedbackModule {}

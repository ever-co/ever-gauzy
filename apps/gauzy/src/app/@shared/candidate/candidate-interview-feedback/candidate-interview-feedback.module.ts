import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbRadioModule,
	NbAccordionModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CandidateCriterionsRatingService,
	CandidatePersonalQualitiesService,
	CandidateTechnologiesService
} from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateInterviewFeedbackComponent } from './candidate-interview-feedback.component';
import { StarRatingInputModule } from '../../star-rating/star-rating-input/star-rating-input.module';
import { CandidateSelectModule } from '../candidate-select/candidate-select.module';
import { StarRatingOutputModule } from '../../star-rating/star-rating-output/star-rating-output.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		ReactiveFormsModule,
		ThemeModule,
		NbInputModule,
		NbButtonModule,
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

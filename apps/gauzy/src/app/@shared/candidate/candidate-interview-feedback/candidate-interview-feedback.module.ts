import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import {
	NbIconModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbRadioModule,
	NbAccordionModule
} from '@nebular/theme';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CandidateInterviewFeedbackComponent } from './candidate-interview-feedback.component';
import { StarRatingInputModule } from '../../star-rating/star-rating-input/star-rating-input.module';
import { CandidateSelectModule } from '../candidate-select/candidate-select.module';
import { CandidatePersonalQualitiesService } from '../../../@core/services/candidate-personal-qualities.service';
import { CandidateTechnologiesService } from '../../../@core/services/candidate-technologies.service';
import { StarRatingOutputModule } from '../../star-rating/star-rating-output/star-rating-output.module';
import { CandidateCriterionsRatingService } from '../../../@core/services/candidate-criterions-rating.service';
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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [CandidateInterviewFeedbackComponent],
	declarations: [CandidateInterviewFeedbackComponent],
	entryComponents: [CandidateInterviewFeedbackComponent],
	providers: [
		CandidateTechnologiesService,
		CandidatePersonalQualitiesService,
		CandidateCriterionsRatingService
	]
})
export class CandidateInterviewFeedbackModule {}

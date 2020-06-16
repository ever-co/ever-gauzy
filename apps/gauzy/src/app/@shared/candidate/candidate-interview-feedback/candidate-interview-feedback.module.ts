import { NgModule } from '@angular/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
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
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CandidateInterviewFeedbackComponent } from './candidate-interview-feedback.component';
import { StarRatingInputModule } from '../../star-rating/star-rating-input/star-rating-input.module';
import { CandidateSelectModule } from '../candidate-select/candidate-select.module';
import { CandidatePersonalQualitiesService } from '../../../@core/services/candidate-personal-qualities.service';
import { CandidateTechnologiesService } from '../../../@core/services/candidate-technologies.service';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
	providers: [CandidateTechnologiesService, CandidatePersonalQualitiesService]
})
export class CandidateInterviewFeedbackModule {}

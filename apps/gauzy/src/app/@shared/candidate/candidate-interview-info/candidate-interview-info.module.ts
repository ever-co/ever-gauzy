import { NgModule } from '@angular/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { CandidateInterviewInfoComponent } from './candidate-interview-info.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import {
	NbIconModule,
	NbButtonModule,
	NbCardModule,
	NbTabsetModule,
} from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { CandidateInterviewMutationModule } from '../candidate-interview-mutation/candidate-interview-mutation.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbTabsetModule,
		CandidateInterviewMutationModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient],
			},
		}),
	],
	exports: [CandidateInterviewInfoComponent],
	declarations: [CandidateInterviewInfoComponent],
	entryComponents: [CandidateInterviewInfoComponent],
})
export class CandidateInterviewInfoModule {}

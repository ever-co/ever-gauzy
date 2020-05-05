import { CandidateInterviewFormComponent } from './../candidate-interview-form/candidate-interview-form.component';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbStepperModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbBadgeModule
} from '@nebular/theme';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { CandidateInterviewMutationComponent } from './candidate-interview-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ReactiveFormsModule,
		NbDatepickerModule,
		NbSelectModule,
		NgSelectModule,
		NbBadgeModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbInputModule,
		NbButtonModule,
		NbIconModule,
		NbStepperModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [
		CandidateInterviewMutationComponent,
		CandidateInterviewFormComponent
	],
	declarations: [
		CandidateInterviewMutationComponent,
		CandidateInterviewFormComponent
	],
	entryComponents: [
		CandidateInterviewMutationComponent,
		CandidateInterviewFormComponent
	]
})
export class CandidateInterviewMutationModule {}

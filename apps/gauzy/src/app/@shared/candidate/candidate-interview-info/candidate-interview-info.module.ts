import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbButtonModule, NbCardModule, NbTabsetModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateInterviewInfoComponent } from './candidate-interview-info.component';
import { CandidateInterviewMutationModule } from '../candidate-interview-mutation/candidate-interview-mutation.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbTabsetModule,
		CandidateInterviewMutationModule,
		TranslateModule
	],
	exports: [CandidateInterviewInfoComponent],
	declarations: [CandidateInterviewInfoComponent]
})
export class CandidateInterviewInfoModule {}

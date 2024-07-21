import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbButtonModule, NbCardModule, NbTabsetModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { CandidateInterviewInfoComponent } from './candidate-interview-info.component';
import { CandidateInterviewMutationModule } from '../candidate-interview-mutation/candidate-interview-mutation.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbTabsetModule,
		CandidateInterviewMutationModule,
		I18nTranslateModule.forChild()
	],
	exports: [CandidateInterviewInfoComponent],
	declarations: [CandidateInterviewInfoComponent]
})
export class CandidateInterviewInfoModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../../shared.module';
import { CandidateInterviewerSelectComponent } from './candidate-interviewer-select.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		I18nTranslateModule.forChild(),
		SharedModule
	],
	declarations: [CandidateInterviewerSelectComponent],
	exports: [CandidateInterviewerSelectComponent],
	providers: []
})
export class CandidateInterviewerSelectModule {}

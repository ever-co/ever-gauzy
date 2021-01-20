import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateSelectComponent } from './candidate-select.component';
import { SharedModule } from '../../shared.module';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbSelectModule,
		SharedModule,
		FormsModule,
		ReactiveFormsModule,
		TranslaterModule
	],
	declarations: [CandidateSelectComponent],
	entryComponents: [CandidateSelectComponent],
	exports: [CandidateSelectComponent],
	providers: []
})
export class CandidateSelectModule {}

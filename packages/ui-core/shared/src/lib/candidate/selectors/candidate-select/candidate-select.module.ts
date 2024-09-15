import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbAutocompleteModule, NbCheckboxModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../../shared.module';
import { CandidateSelectComponent } from './candidate-select.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCheckboxModule,
		NbSelectModule,
		NbAutocompleteModule,
		TranslateModule.forChild(),
		SharedModule
	],
	declarations: [CandidateSelectComponent],
	exports: [CandidateSelectComponent],
	providers: []
})
export class CandidateSelectModule {}

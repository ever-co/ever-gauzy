import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateSelectComponent } from './candidate-select.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [ThemeModule, NbSelectModule, SharedModule, FormsModule, ReactiveFormsModule, TranslateModule],
	declarations: [CandidateSelectComponent],
	exports: [CandidateSelectComponent],
	providers: []
})
export class CandidateSelectModule {}

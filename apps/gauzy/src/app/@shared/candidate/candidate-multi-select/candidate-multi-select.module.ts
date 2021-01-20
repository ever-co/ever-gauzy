import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateMultiSelectComponent } from './candidate-multi-select.component';
import { SharedModule } from '../../shared.module';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [ThemeModule, NbSelectModule, SharedModule, TranslaterModule],
	declarations: [CandidateMultiSelectComponent],
	entryComponents: [CandidateMultiSelectComponent],
	exports: [CandidateMultiSelectComponent],
	providers: []
})
export class CandidateMultiSelectModule {}

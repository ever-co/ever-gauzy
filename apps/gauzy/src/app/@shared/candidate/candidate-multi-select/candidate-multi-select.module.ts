import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { CandidateMultiSelectComponent } from './candidate-multi-select.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [ThemeModule, NbSelectModule, SharedModule, TranslateModule],
	declarations: [CandidateMultiSelectComponent],
	exports: [CandidateMultiSelectComponent],
	providers: []
})
export class CandidateMultiSelectModule {}

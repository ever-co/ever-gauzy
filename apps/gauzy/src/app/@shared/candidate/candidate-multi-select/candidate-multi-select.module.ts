import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { CandidateMultiSelectComponent } from './candidate-multi-select.component';

@NgModule({
	imports: [CommonModule, NbSelectModule, I18nTranslateModule.forChild(), SharedModule],
	declarations: [CandidateMultiSelectComponent],
	exports: [CandidateMultiSelectComponent]
})
export class CandidateMultiSelectModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ProposalTemplateSelectComponent } from './proposal-template-select/proposal-template-select.component';

@NgModule({
	declarations: [ProposalTemplateSelectComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild()],
	exports: [ProposalTemplateSelectComponent]
})
export class ProposalTemplateSelectModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { ProposalTemplateSelectComponent } from './proposal-template-select/proposal-template-select.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbSelectModule, I18nTranslateModule.forChild()],
	declarations: [ProposalTemplateSelectComponent],
	exports: [ProposalTemplateSelectComponent]
})
export class ProposalTemplateSelectModule {}

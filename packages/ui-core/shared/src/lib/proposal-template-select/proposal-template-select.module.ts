import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ProposalTemplateSelectComponent } from './proposal-template-select/proposal-template-select.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbSelectModule, TranslateModule.forChild()],
	declarations: [ProposalTemplateSelectComponent],
	exports: [ProposalTemplateSelectComponent]
})
export class ProposalTemplateSelectModule {}

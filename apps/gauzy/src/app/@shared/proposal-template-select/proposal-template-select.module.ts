import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProposalTemplateSelectComponent } from './proposal-template-select/proposal-template-select.component';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';

@NgModule({
	declarations: [ProposalTemplateSelectComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, TranslateModule],
	exports: [ProposalTemplateSelectComponent]
})
export class ProposalTemplateSelectModule {}

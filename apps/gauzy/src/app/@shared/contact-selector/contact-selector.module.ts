import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectorComponent } from './contact-selector.component';

@NgModule({
	declarations: [ContactSelectorComponent],
	exports: [ContactSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, TranslateModule.forChild(), NgSelectModule]
})
export class ContactSelectorModule {}

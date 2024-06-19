import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectorComponent } from './contact-selector.component';

@NgModule({
	declarations: [ContactSelectorComponent],
	exports: [ContactSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class ContactSelectorModule {}

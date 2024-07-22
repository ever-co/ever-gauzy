import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectorComponent } from './contact-selector.component';

@NgModule({
	declarations: [ContactSelectorComponent],
	exports: [ContactSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class ContactSelectorModule {}

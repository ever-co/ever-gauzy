import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectComponent } from './contact-select.component';

@NgModule({
	declarations: [ContactSelectComponent],
	exports: [ContactSelectComponent],
	imports: [CommonModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class ContactSelectModule {}

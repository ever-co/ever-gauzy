import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgxFaqComponent } from './faq.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, I18nTranslateModule.forChild()],
	declarations: [NgxFaqComponent],
	exports: [NgxFaqComponent]
})
export class NgxFaqModule {}

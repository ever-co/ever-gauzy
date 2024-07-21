import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NgxFaqComponent } from './faq.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, I18nTranslateModule.forChild()],
	declarations: [NgxFaqComponent],
	exports: [NgxFaqComponent]
})
export class NgxFaqModule {}

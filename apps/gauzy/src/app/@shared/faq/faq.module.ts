import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { NgxFaqComponent } from './faq.component';

@NgModule({
	declarations: [NgxFaqComponent],
	imports: [ThemeModule, I18nTranslateModule.forChild(), NbButtonModule, NbIconModule],
	providers: [],
	exports: [NgxFaqComponent]
})
export class NgxFaqModule {}

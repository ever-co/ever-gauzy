import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { NgxFaqComponent } from './faq.component';

@NgModule({
	declarations: [NgxFaqComponent],
	imports: [ThemeModule, TranslateModule, NbButtonModule, NbIconModule],
	providers: [],
	exports: [NgxFaqComponent]
})
export class NgxFaqModule {}

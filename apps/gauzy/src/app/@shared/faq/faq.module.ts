import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { TranslateModule } from '../translate/translate.module';
import { NgxFaqComponent } from './faq.component';

@NgModule({
	declarations: [NgxFaqComponent],
	imports: [
		ThemeModule,
		TranslateModule,
        NbButtonModule,
        NbIconModule
	],
	providers: [],
	exports: [NgxFaqComponent]
})
export class NgxFaqModule {}

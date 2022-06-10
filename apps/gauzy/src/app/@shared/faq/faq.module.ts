import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { TranslateModule } from '../translate/translate.module';
import { FaqComponent } from './faq.component';

@NgModule({
	declarations: [FaqComponent],
	imports: [
		ThemeModule,
		TranslateModule,
        NbButtonModule,
        NbIconModule
	],
	providers: [],
	exports: [FaqComponent]
})
export class FaqModule {}

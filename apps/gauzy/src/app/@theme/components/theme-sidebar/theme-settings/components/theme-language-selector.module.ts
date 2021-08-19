import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from './../../../../../@shared/translate/translate.module';
import { ThemeLanguageSelectorComponent } from './theme-language-selector.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		TranslateModule
	],
	exports: [
		ThemeLanguageSelectorComponent
	],
	declarations: [
		ThemeLanguageSelectorComponent
	],
	providers: []
})
export class ThemeLanguageSelectorModule {}
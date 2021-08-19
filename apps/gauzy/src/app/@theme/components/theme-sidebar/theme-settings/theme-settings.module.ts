import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbIconModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { ThemeSettingsComponent } from './theme-settings.component';
import { TranslateModule } from './../../../../@shared/translate/translate.module';
import { ThemeLanguageSelectorModule } from './components/theme-language-selector.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule,
		ThemeLanguageSelectorModule
	],
	exports: [
		ThemeSettingsComponent
	],
	declarations: [
		ThemeSettingsComponent
	],
	providers: []
})
export class ThemeSettingsModule {}

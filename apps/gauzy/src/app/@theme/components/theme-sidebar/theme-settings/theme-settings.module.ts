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
import { ThemeSelectorModule } from './components/theme-selector/theme-selector.module';
import { NbCardModule, NbListModule } from '@nebular/theme';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector.component';
import { LayoutSelectorModule } from './components/layout-selector/layout-selector.module';
import { DirectivesModule } from 'apps/gauzy/src/app/@shared/directives/directives.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule,
		ThemeLanguageSelectorModule,
		LayoutSelectorModule,
		ThemeSelectorModule,
		NbCardModule,
		NbListModule,
		DirectivesModule
	],
	exports: [
		ThemeSettingsComponent,
		ThemeSelectorComponent
	],
	declarations: [
		ThemeSettingsComponent
	],
	providers: []
})
export class ThemeSettingsModule { }

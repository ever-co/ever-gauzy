import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { DirectivesModule } from '@gauzy/ui-core/shared';
import { ThemeSettingsComponent } from './theme-settings.component';
import { ThemeLanguageSelectorModule } from './components/theme-language-selector/theme-language-selector.module';
import { ThemeSelectorModule } from './components/theme-selector/theme-selector.module';
import { LayoutSelectorModule } from './components/layout-selector/layout-selector.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		ThemeLanguageSelectorModule,
		LayoutSelectorModule,
		ThemeSelectorModule,
		NbCardModule,
		NbListModule,
		DirectivesModule
	],
	exports: [ThemeSettingsComponent],
	declarations: [ThemeSettingsComponent],
	providers: []
})
export class ThemeSettingsModule {}

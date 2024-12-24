import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DirectivesModule } from '@gauzy/ui-core/shared';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { LayoutSelectorModule } from './components/layout-selector/layout-selector.module';
import { ThemeLanguageSelectorModule } from './components/theme-language-selector/theme-language-selector.module';
import { ThemeSelectorModule } from './components/theme-selector/theme-selector.module';
import { ThemeSettingsComponent } from './theme-settings.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule.forChild(),
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

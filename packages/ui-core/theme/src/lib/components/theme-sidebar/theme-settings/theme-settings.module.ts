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
import { TranslateModule } from '@ngx-translate/core';
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

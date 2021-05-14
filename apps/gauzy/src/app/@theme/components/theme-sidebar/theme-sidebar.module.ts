import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbIconModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { ThemeSidebarComponent } from './theme-sidebar.component';
import { TranslateModule } from '../../../@shared/translate/translate.module';
import { ThemeSettingsComponent } from './theme-settings/theme-settings.component';
import { ChangelogComponent } from './changelog/changelog.component';
import { LanguageSelectorModule } from '../../../@shared/language/language-selector/language-selector.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule,
		LanguageSelectorModule
	],
	exports: [
		ThemeSidebarComponent,
		ThemeSettingsComponent,
		ChangelogComponent
	],
	declarations: [
		ThemeSidebarComponent,
		ThemeSettingsComponent,
		ChangelogComponent
	],
	providers: []
})
export class ThemeSidebarModule {}

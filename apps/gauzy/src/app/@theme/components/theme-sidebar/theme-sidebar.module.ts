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

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule
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

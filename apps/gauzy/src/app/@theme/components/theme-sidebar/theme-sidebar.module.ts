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
import { ThemeSettingsModule } from './theme-settings/theme-settings.module';
import { ChangelogComponent } from './changelog/changelog.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule,
		ThemeSettingsModule
	],
	exports: [
		ThemeSidebarComponent,
		ChangelogComponent
	],
	declarations: [
		ThemeSidebarComponent,
		ChangelogComponent
	],
	providers: []
})
export class ThemeSidebarModule {}

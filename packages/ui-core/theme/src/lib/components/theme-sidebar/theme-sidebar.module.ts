import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeSidebarComponent } from './theme-sidebar.component';
import { ThemeSettingsModule } from './theme-settings/theme-settings.module';
import { ChangelogComponent } from './changelog/changelog.component';
import { ThemeSettingsComponent } from './theme-settings/theme-settings.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		ThemeSettingsModule
	],
	exports: [ThemeSidebarComponent, ChangelogComponent, ThemeSettingsComponent],
	declarations: [ThemeSidebarComponent, ChangelogComponent],
	providers: []
})
export class ThemeSidebarModule {}

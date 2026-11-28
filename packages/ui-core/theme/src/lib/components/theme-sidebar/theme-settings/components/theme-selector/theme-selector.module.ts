import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbPopoverModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeSelectorContainerComponent } from './container/theme-selector-container.component';
import { SwitchThemeComponent } from './switch-theme/switch-theme.component';
import { ThemeSelectorImageComponent } from './theme-selector-image/theme-selector-image.component';
import { ThemeSelectorComponent } from './theme-selector.component';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';

@NgModule({
	declarations: [
		ThemeSelectorComponent,
		SwitchThemeComponent,
		ThemeSelectorImageComponent,
		ThemeSelectorContainerComponent,
		ThemeToggleComponent
	],
	exports: [
		ThemeSelectorComponent,
		SwitchThemeComponent,
		ThemeSelectorImageComponent,
		ThemeSelectorContainerComponent,
		ThemeToggleComponent
	],
	imports: [
		CommonModule,
		NbSelectModule,
		NbToggleModule,
		TranslatePipe,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule
	]
})
export class ThemeSelectorModule {}

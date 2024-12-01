import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeSelectorContainerComponent } from './container/theme-selector-container.component';
import { SwitchThemeComponent } from './switch-theme/switch-theme.component';
import { ThemeSelectorImageComponent } from './theme-selector-image/theme-selector-image.component';
import { ThemeSelectorComponent } from './theme-selector.component';

@NgModule({
	declarations: [
		ThemeSelectorComponent,
		SwitchThemeComponent,
		ThemeSelectorImageComponent,
		ThemeSelectorContainerComponent
	],
	exports: [
		ThemeSelectorComponent,
		SwitchThemeComponent,
		ThemeSelectorImageComponent,
		ThemeSelectorContainerComponent
	],
	imports: [CommonModule, NbSelectModule, NbToggleModule, TranslateModule.forChild(), NbButtonModule]
})
export class ThemeSelectorModule {}

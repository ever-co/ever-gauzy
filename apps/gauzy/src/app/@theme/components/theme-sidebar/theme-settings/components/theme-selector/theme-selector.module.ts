import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeSelectorComponent } from './theme-selector.component';
import { NbSelectModule, NbToggleModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SwitchThemeComponent } from './switch-theme/switch-theme.component';
import { ThemeSelectorImageComponent } from './theme-selector-image/theme-selector-image.component';

@NgModule({
	declarations: [ThemeSelectorComponent, SwitchThemeComponent, ThemeSelectorImageComponent],
	exports: [ThemeSelectorComponent, SwitchThemeComponent, ThemeSelectorImageComponent],
	imports: [CommonModule, NbSelectModule, NbToggleModule, TranslateModule.forChild(), NbButtonModule]
})
export class ThemeSelectorModule {}

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbPopoverModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
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
	imports: [
		CommonModule,
		NbSelectModule,
		NbToggleModule,
		TranslateModule.forChild(),
		NbButtonModule,
		NbIconModule,
		// The theme list opens as a popover so it does not expand inside — and
		// scroll — the Quick Settings panel it is rendered in.
		NbPopoverModule
	]
})
export class ThemeSelectorModule {}

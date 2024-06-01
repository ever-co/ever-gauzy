import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeLanguageSelectorComponent } from './theme-language-selector.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbSelectModule, TranslateModule.forChild()],
	exports: [ThemeLanguageSelectorComponent],
	declarations: [ThemeLanguageSelectorComponent],
	providers: []
})
export class ThemeLanguageSelectorModule {}

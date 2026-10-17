import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeLanguageSelectorComponent } from './theme-language-selector.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbSelectModule, TranslatePipe],
	exports: [ThemeLanguageSelectorComponent],
	declarations: [ThemeLanguageSelectorComponent],
	providers: []
})
export class ThemeLanguageSelectorModule {}

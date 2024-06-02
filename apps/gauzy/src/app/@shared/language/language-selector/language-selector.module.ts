import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbBadgeModule, NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorComponent } from './language-selector.component';
import { LanguagesService } from '../../../@core/services/languages.service';

@NgModule({
	imports: [CommonModule, NbSelectModule, NbBadgeModule, FormsModule, NgSelectModule, I18nTranslateModule.forChild()],
	exports: [LanguageSelectorComponent],
	declarations: [LanguageSelectorComponent],
	providers: [LanguagesService]
})
export class LanguageSelectorModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbBadgeModule, NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageSelectorComponent } from './language-selector.component';
import { LanguagesService } from '@gauzy/ui-core/core';

@NgModule({
	imports: [CommonModule, NbSelectModule, NbBadgeModule, FormsModule, NgSelectModule, TranslateModule.forChild()],
	exports: [LanguageSelectorComponent],
	declarations: [LanguageSelectorComponent],
	providers: [LanguagesService]
})
export class LanguageSelectorModule {}

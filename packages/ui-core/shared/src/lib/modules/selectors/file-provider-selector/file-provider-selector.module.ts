import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { FileProviderSelectorComponent } from './file-provider-selector.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbSelectModule, I18nTranslateModule.forChild()],
	declarations: [FileProviderSelectorComponent],
	exports: [FileProviderSelectorComponent]
})
export class FileProviderSelectorModule {}

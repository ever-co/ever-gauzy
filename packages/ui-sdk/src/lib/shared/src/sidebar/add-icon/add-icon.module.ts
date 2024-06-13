import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AddIconComponent } from './add-icon.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, I18nTranslateModule.forChild()],
	declarations: [AddIconComponent],
	exports: [AddIconComponent]
})
export class AddIconModule {}

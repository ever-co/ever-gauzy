import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NoDataMessageComponent } from './no-data-message.component';

@NgModule({
	imports: [CommonModule, NbCardModule, NbEvaIconsModule, NbIconModule, I18nTranslateModule.forChild()],
	declarations: [NoDataMessageComponent],
	exports: [NoDataMessageComponent]
})
export class NoDataMessageModule {}

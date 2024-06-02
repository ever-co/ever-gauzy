import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NoDataMessageComponent } from './no-data-message.component';

@NgModule({
	declarations: [NoDataMessageComponent],
	exports: [NoDataMessageComponent],
	imports: [I18nTranslateModule.forChild(), CommonModule, NbCardModule, NbIconModule, NbEvaIconsModule]
})
export class NoDataMessageModule {}

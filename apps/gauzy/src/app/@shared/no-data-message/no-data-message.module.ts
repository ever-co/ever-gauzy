import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NoDataMessageComponent } from './no-data-message.component';

@NgModule({
	declarations: [NoDataMessageComponent],
	exports: [NoDataMessageComponent],
	imports: [TranslateModule.forChild(), CommonModule, NbCardModule, NbIconModule, NbEvaIconsModule]
})
export class NoDataMessageModule {}

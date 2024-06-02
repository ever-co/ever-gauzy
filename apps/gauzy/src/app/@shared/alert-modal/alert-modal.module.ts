import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AlertModalComponent } from './alert-modal.component';

@NgModule({
	declarations: [AlertModalComponent],
	imports: [CommonModule, NbCardModule, NbButtonModule, NbDialogModule, I18nTranslateModule.forChild()]
})
export class AlertModalModule {}

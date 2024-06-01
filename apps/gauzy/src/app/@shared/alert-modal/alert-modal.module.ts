import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { AlertModalComponent } from './alert-modal.component';

@NgModule({
	declarations: [AlertModalComponent],
	imports: [CommonModule, NbCardModule, NbButtonModule, NbDialogModule, TranslateModule.forChild()]
})
export class AlertModalModule {}

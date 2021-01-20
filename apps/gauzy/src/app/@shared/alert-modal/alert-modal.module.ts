import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogModule } from '@nebular/theme';
import { AlertModalComponent } from './alert-modal.component';
import { TranslateModule } from '../translate/translate.module';

@NgModule({
	declarations: [AlertModalComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbDialogModule,
		TranslateModule
	]
})
export class AlertModalModule {}

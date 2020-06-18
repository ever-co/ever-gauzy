import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertModalComponent } from './alert-modal.component';
import { NbCardModule, NbButtonModule, NbDialogModule } from '@nebular/theme';

@NgModule({
	declarations: [AlertModalComponent],
	imports: [CommonModule, NbCardModule, NbButtonModule, NbDialogModule]
})
export class AlertModalModule {}

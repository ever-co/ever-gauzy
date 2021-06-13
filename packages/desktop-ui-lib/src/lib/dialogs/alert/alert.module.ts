import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertComponent } from './alert.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbAlertModule
} from '@nebular/theme';

@NgModule({
	declarations: [AlertComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		NbAlertModule
	],
    exports: [AlertComponent]
})
export class AlertModule {}

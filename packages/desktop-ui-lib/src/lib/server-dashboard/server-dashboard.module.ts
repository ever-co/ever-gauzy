import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServerDashboardComponent } from './server-dashboard.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbDialogModule,
	NbDialogService,
	NbButtonModule
} from '@nebular/theme';

@NgModule({
	declarations: [ServerDashboardComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbDialogModule,
		NbButtonModule
	],
	exports: [ServerDashboardComponent],
	providers: [NbDialogService]
})
export class ServerDashboardModule {}

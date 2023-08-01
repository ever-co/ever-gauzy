import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServerDashboardComponent } from './server-dashboard.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbDialogModule,
	NbDialogService,
	NbButtonModule,
	NbSpinnerModule,
	NbAccordionModule
} from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';

@NgModule({
	declarations: [ServerDashboardComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbDialogModule,
		NbButtonModule,
		NbSpinnerModule,
		NbAccordionModule,
		DesktopDirectiveModule
	],
	exports: [ServerDashboardComponent],
	providers: [NbDialogService]
})
export class ServerDashboardModule {}

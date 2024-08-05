import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
	NbAccordionModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbDialogService,
	NbIconModule,
	NbLayoutModule,
	NbSpinnerModule
} from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { ServerDashboardComponent } from './server-dashboard.component';

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
		DesktopDirectiveModule,
		LanguageModule.forChild()
	],
	exports: [ServerDashboardComponent],
	providers: [NbDialogService]
})
export class ServerDashboardModule {}

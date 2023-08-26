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
import { NgxTranslateModule } from '../ngx-translate';
import { LanguageSelectorService } from '../language/language-selector.service';

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
		NgxTranslateModule
	],
	exports: [ServerDashboardComponent],
	providers: [NbDialogService, LanguageSelectorService]
})
export class ServerDashboardModule {}

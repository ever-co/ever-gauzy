import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsComponent } from './settings.component';
import {
	NbLayoutModule,
	NbSidebarModule,
	NbMenuModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbSelectModule,
	NbToggleModule,
	NbInputModule,
	NbButtonModule,
	NbAlertModule,
	NbProgressBarModule,
	NbTabsetModule,
	NbToastrService,
	NbAccordionModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';

@NgModule({
	declarations: [SettingsComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbSidebarModule,
		NbMenuModule.forRoot(),
		NbCardModule,
		NbIconModule,
		NbListModule,
		NbSelectModule,
		FormsModule,
		NbToggleModule,
		NbInputModule,
		NbButtonModule,
		NbAlertModule,
		NbProgressBarModule,
		NbTabsetModule,
		NbAccordionModule
	],
	providers: [
		NbToastrService
	],
	exports: [SettingsComponent]
})
export class SettingsModule {}

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
	NbToggleModule
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
		NbToggleModule
	],
	exports: [SettingsComponent]
})
export class SettingsModule {}

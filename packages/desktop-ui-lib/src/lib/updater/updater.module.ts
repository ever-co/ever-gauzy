import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdaterComponent } from './updater.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbAlertModule,
	NbAccordionModule
} from '@nebular/theme';

@NgModule({
	declarations: [UpdaterComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		NbAlertModule,
		NbAccordionModule
	]
})
export class UpdaterModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import {
	NbStepperModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule
} from '@nebular/theme';
import { HubstaffRoutingModule } from './hubstaff-routing.module';

@NgModule({
	declarations: [HubstaffComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		Ng2SmartTableModule,
		NbCardModule,
		NbStepperModule,
		HubstaffRoutingModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule
	]
})
export class HubstaffModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackerComponent } from './time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import {
	NbLayoutModule,
	NbCardModule,
	NbToggleModule,
	NbSelectModule,
	NbInputModule,
	NbButtonModule,
	NbSpinnerModule,
	NbIconModule,
	NbSidebarModule,
	NbSidebarService,
	NbCheckboxModule
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { FormsModule } from '@angular/forms';

@NgModule({
	declarations: [TimeTrackerComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbToggleModule,
		NbSelectModule,
		NbInputModule,
		NbButtonModule,
		NbSpinnerModule,
		NbIconModule,
		NbEvaIconsModule,
		NbSidebarModule,
		FormsModule,
		NbCheckboxModule
	],
	providers: [NbSidebarService, TimeTrackerService],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {}

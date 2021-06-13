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
	NbCheckboxModule,
	NbDialogService,
	NbDialogModule,
	NbToastrService
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

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
		NbCheckboxModule,
		ReactiveFormsModule,
		NgSelectModule,
		NbDialogModule
	],
	providers: [
		NbSidebarService,
		TimeTrackerService,
		NbDialogService,
		NbToastrService
	],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {}

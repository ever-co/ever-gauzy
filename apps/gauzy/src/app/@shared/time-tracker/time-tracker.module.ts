import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackerComponent } from './time-tracker/time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import {
	NbIconModule,
	NbButtonModule,
	NbTooltipModule,
	NbCheckboxModule,
	NbDatepickerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../shared.module';
import { RouterModule } from '@angular/router';
import { TimerPickerModule } from '../timer-picker/timer-picker.module';
import { TaskSelectModule } from '../task-select/task-select.module';
import { ProjectSelectModule } from '../project-select/project-select.module';
import { AngularDraggableModule } from 'angular2-draggable';
import { NgxPermissionsModule } from 'ngx-permissions';

@NgModule({
	declarations: [TimeTrackerComponent],
	imports: [
		CommonModule,
		RouterModule,
		NbIconModule,
		NbButtonModule,
		NbTooltipModule,
		FormsModule,
		TranslateModule,
		NbCheckboxModule,
		NbDatepickerModule,
		SharedModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		AngularDraggableModule,
		NgxPermissionsModule
	],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {
	static forRoot(): ModuleWithProviders<TimeTrackerModule> {
		return {
			ngModule: TimeTrackerModule,
			providers: [TimeTrackerService]
		};
	}
}

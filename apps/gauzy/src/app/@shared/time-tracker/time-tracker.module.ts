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
import { ProjectSelectorComponent } from './project/project.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TaskSelectorComponent } from './task/task.component';
import { TimerPickerComponent } from './timer-picker/timer-picker.component';
import { SharedModule } from '../shared.module';
import { RouterModule } from '@angular/router';

@NgModule({
	declarations: [
		TimeTrackerComponent,
		ProjectSelectorComponent,
		TaskSelectorComponent,
		TimerPickerComponent
	],
	imports: [
		CommonModule,
		RouterModule,
		NbIconModule,
		NbButtonModule,
		NbTooltipModule,
		NgSelectModule,
		FormsModule,
		TranslateModule,
		NbCheckboxModule,
		NbDatepickerModule,
		SharedModule
	],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: TimeTrackerModule,
			providers: [TimeTrackerService]
		};
	}
}

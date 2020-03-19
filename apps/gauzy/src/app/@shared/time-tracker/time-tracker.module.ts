import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackerComponent } from './time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import { NbIconModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { ProjectSelectorComponent } from './project/project.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TaskSelectorComponent } from './task/task.component';

@NgModule({
	declarations: [
		TimeTrackerComponent,
		ProjectSelectorComponent,
		TaskSelectorComponent
	],
	imports: [
		CommonModule,
		NbIconModule,
		NbButtonModule,
		NbTooltipModule,
		NgSelectModule,
		FormsModule,
		TranslateModule
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

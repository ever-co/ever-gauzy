import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
	NbAlertModule,
	NbButtonModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbIconModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxDraggableDomModule } from 'ngx-draggable-dom';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';
import { TimeTrackerService } from '@gauzy/ui-core/core';
import { TimeTrackerComponent } from './time-tracker/time-tracker.component';
import { TimeTrackerStatusModule } from './components/time-tracker-status/time-tracker-status.module';
import { SharedModule } from '../shared.module';
import { TimerPickerModule } from '../timer-picker/timer-picker.module';
import { TaskSelectModule } from '../tasks/task-select/task-select.module';
import { ProjectSelectModule } from '../selectors/project/project.module';
import { TeamSelectModule } from '../selectors/team/team.module';
import { ContactSelectorModule } from '../contact-selector/contact-selector.module';

@NgModule({
	declarations: [TimeTrackerComponent],
	imports: [
		CommonModule,
		FormsModule,
		RouterModule,
		FontAwesomeModule,
		NbAlertModule,
		NbButtonModule,
		NbCheckboxModule,
		NbDatepickerModule,
		NbIconModule,
		NbTooltipModule,
		NgxDraggableDomModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		TeamSelectModule,
		ContactSelectorModule,
		TimeTrackerStatusModule
	],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {
	/**
	 * Returns a ModuleWithProviders object that specifies the TimeTrackerModule and its providers.
	 *
	 * @return {ModuleWithProviders<TimeTrackerModule>} A ModuleWithProviders object with the TimeTrackerModule and its providers.
	 */
	static forRoot(): ModuleWithProviders<TimeTrackerModule> {
		return {
			ngModule: TimeTrackerModule,
			providers: [TimeTrackerService]
		};
	}
}

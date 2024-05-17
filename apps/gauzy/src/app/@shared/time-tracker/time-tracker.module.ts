import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackerComponent } from './time-tracker/time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import {
	NbIconModule,
	NbButtonModule,
	NbTooltipModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbAlertModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../shared.module';
import { RouterModule } from '@angular/router';
import { TimerPickerModule } from '../timer-picker/timer-picker.module';
import { ProjectSelectModule } from '../project-select/project-select.module';
import { NgxDraggableDomModule } from 'ngx-draggable-dom';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ContactSelectorModule } from '../contact-selector/contact-selector.module';
import { TaskSelectModule } from '../tasks/task-select/task-select.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TimeTrackerStatusModule } from './components/time-tracker-status/time-tracker-status.module';

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
		NgxDraggableDomModule,
		NgxPermissionsModule,
		ContactSelectorModule,
		FontAwesomeModule,
		NbAlertModule,
		TimeTrackerStatusModule
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

import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TimeTrackerComponent } from './time-tracker/time-tracker.component';
import {
	NbIconModule,
	NbButtonModule,
	NbTooltipModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbAlertModule
} from '@nebular/theme';
import { NgxDraggableDomModule } from 'ngx-draggable-dom';
import { NgxPermissionsModule } from 'ngx-permissions';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TimeTrackerService } from '@gauzy/ui-sdk/common';
import { SharedModule } from '../shared.module';
import { TimerPickerModule } from '../timer-picker/timer-picker.module';
import { ContactSelectorModule } from '../contact-selector/contact-selector.module';
import { TaskSelectModule } from '../tasks/task-select/task-select.module';
import { TimeTrackerStatusModule } from './components/time-tracker-status/time-tracker-status.module';
import { ProjectSelectModule } from '../selectors/project-select/project-select.module';

@NgModule({
	declarations: [TimeTrackerComponent],
	imports: [
		CommonModule,
		RouterModule,
		NbIconModule,
		NbButtonModule,
		NbTooltipModule,
		FormsModule,
		I18nTranslateModule.forChild(),
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

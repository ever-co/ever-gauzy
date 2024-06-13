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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { TimeTrackerService } from '@gauzy/ui-core/common';
import { TimeTrackerComponent } from './time-tracker/time-tracker.component';
import { TimeTrackerStatusModule } from './components/time-tracker-status/time-tracker-status.module';
import { SharedModule } from '../shared.module';
import { TimerPickerModule } from '../timer-picker/timer-picker.module';
import { TaskSelectModule } from '../tasks/task-select/task-select.module';
import { ProjectSelectModule } from '../selectors/project/project.module';
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
		I18nTranslateModule.forChild(),
		SharedModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		ContactSelectorModule,
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

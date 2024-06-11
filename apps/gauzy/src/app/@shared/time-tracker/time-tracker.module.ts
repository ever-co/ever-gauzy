import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
import {
	SharedModule,
	TimerPickerModule,
	TaskSelectModule,
	ProjectSelectModule,
	ContactSelectorModule
} from '@gauzy/ui-sdk/shared';
import { TimeTrackerComponent } from './time-tracker/time-tracker.component';
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

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditTimeLogModalComponent } from './edit-time-log-modal.component';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { ProjectSelectModule } from '../../project-select/project-select.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSpinnerModule,
	NbIconModule,
	NbTooltipModule
} from '@nebular/theme';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { ContactSelectorModule } from '../../contact-selector/contact-selector.module';
import { TaskSelectModule } from '../../tasks/task-select/task-select.module';
import { DialogsModule } from '../../dialogs';
import { NbInputModule } from '@nebular/theme';

@NgModule({
	declarations: [EditTimeLogModalComponent],
	exports: [EditTimeLogModalComponent],
	imports: [
		CommonModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbCheckboxModule,
		EmployeeMultiSelectModule,
		NbSpinnerModule,
		NbIconModule,
		ContactSelectorModule,
		DialogsModule,
		NbTooltipModule,
		NbInputModule
	]
})
export class EditTimeLogModalModule {}

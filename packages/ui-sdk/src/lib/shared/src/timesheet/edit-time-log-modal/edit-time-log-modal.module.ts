import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSpinnerModule,
	NbIconModule,
	NbTooltipModule,
	NbInputModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DialogsModule } from '../../dialogs/dialogs.module';
import { ProjectSelectModule } from '../../selectors';
import { EditTimeLogModalComponent } from './edit-time-log-modal.component';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { SharedModule } from '../../shared.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { ContactSelectorModule } from '../../contact-selector/contact-selector.module';
import { TaskSelectModule } from '../../tasks/task-select/task-select.module';

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

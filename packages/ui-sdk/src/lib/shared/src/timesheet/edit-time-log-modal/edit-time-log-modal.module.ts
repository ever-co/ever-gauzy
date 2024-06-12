import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { DialogsModule } from '../../dialogs/dialogs.module';
import { ProjectSelectModule } from '../../selectors/project';
import { EditTimeLogModalComponent } from './edit-time-log-modal.component';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { ContactSelectorModule } from '../../contact-selector/contact-selector.module';
import { TaskSelectModule } from '../../tasks/task-select/task-select.module';

@NgModule({
	declarations: [EditTimeLogModalComponent],
	exports: [EditTimeLogModalComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		SharedModule,
		DialogsModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		EmployeeMultiSelectModule,
		ContactSelectorModule
	]
})
export class EditTimeLogModalModule {}

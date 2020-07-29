import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditTimeLogModalComponent } from './edit-time-log-modal.component';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { TaskSelectModule } from '../../task-select/task-select.module';
import { ProjectSelectModule } from '../../project-select/project-select.module';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbDialogModule,
	NbSpinnerModule,
	NbIconModule
} from '@nebular/theme';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { ContactSelectorModule } from '../../contact-selector/contact-selector.module';

@NgModule({
	declarations: [EditTimeLogModalComponent],
	exports: [EditTimeLogModalComponent],
	entryComponents: [EditTimeLogModalComponent],
	imports: [
		CommonModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		TranslateModule,
		SharedModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NbCheckboxModule,
		EmployeeMultiSelectModule,
		NbSpinnerModule,
		NbIconModule,
		ContactSelectorModule
	]
})
export class EditTimeLogModalModule {}

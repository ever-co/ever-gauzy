// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals/approvals.component';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbContextMenuModule,
	NbIconModule,
	NbDialogModule,
	NbPopoverModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FormsModule } from '@angular/forms';
import { TimerPickerModule } from 'apps/gauzy/src/app/@shared/timer-picker/timer-picker.module';
import { TaskSelectModule } from 'apps/gauzy/src/app/@shared/task-select/task-select.module';
import { ProjectSelectModule } from 'apps/gauzy/src/app/@shared/project-select/project-select.module';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import { MomentModule } from 'ngx-moment';

@NgModule({
	declarations: [ApprovalsComponent],
	imports: [
		CommonModule,
		ApprovalsRoutingModule,
		NbCardModule,
		TranslateModule,
		NbCheckboxModule,
		NbButtonModule,
		NbSelectModule,
		SharedModule,
		NbDatepickerModule,
		FormsModule,
		NbContextMenuModule,
		NbIconModule,
		NbDialogModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		NbIconModule,
		EmployeeSelectorsModule,
		NbPopoverModule,
		MomentModule
	]
})
export class ApprovalsModule {}

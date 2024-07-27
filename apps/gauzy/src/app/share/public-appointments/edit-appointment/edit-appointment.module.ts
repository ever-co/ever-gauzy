import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeAppointmentService } from '@gauzy/ui-core/core';
import { EditAppointmentComponent } from './edit-appointment.component';
import { EditAppointmentRoutingModule } from './edit-appointment.routing.module';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		EditAppointmentRoutingModule,
		ManageAppointmentModule
	],
	declarations: [EditAppointmentComponent],
	providers: [EmployeeAppointmentService]
})
export class EditAppointmentModule {}

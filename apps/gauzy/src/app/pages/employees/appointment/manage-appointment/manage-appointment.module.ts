import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbCheckboxModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { AppointmentEmployeesService } from '@gauzy/ui-core/core';
import { EmployeeMultiSelectModule, SharedModule, TimerPickerModule } from '@gauzy/ui-core/shared';
import { ManageAppointmentComponent } from './manage-appointment.component';
import { EmployeeSchedulesModule } from '../employee-schedules/employee-schedules.module';
import { ManageAppointmentRoutingModule } from './manage-appointment-routing.module';

@NgModule({
	imports: [
		ManageAppointmentRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		EmployeeSchedulesModule,
		NbIconModule,
		NbSpinnerModule,
		TimerPickerModule,
		NbCheckboxModule,
		SharedModule,
		EmployeeMultiSelectModule,
		NgSelectModule,
		TranslateModule.forChild()
	],
	exports: [ManageAppointmentComponent],
	declarations: [ManageAppointmentComponent],
	providers: [AppointmentEmployeesService]
})
export class ManageAppointmentModule {}

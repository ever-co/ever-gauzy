import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbCheckboxModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { AppointmentEmployeesService } from '@gauzy/ui-core/core';
import { EmployeeMultiSelectModule, SharedModule, TimerPickerModule } from '@gauzy/ui-core/shared';
import { ManageAppointmentComponent } from './manage-appointment.component';
import { EmployeeSchedulesModule } from '../employee-schedules/employee-schedules.module';
import { ManageAppointmentRoutingModule } from './manage-appointment-routing.module';

@NgModule({
	imports: [
		ManageAppointmentRoutingModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		EmployeeSchedulesModule,
		ReactiveFormsModule,
		NbIconModule,
		NbSpinnerModule,
		TimerPickerModule,
		NbCheckboxModule,
		SharedModule,
		EmployeeMultiSelectModule,
		NgSelectModule,
		I18nTranslateModule.forChild()
	],
	exports: [ManageAppointmentComponent],
	declarations: [ManageAppointmentComponent],
	providers: [AppointmentEmployeesService]
})
export class ManageAppointmentModule {}

import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	ImageUploaderModule,
	ManageAppointmentModule,
	MiscellaneousModule,
	SelectorsModule,
	SharedModule,
	TableComponentsModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { PublicLayoutModule } from '@gauzy/plugin-public-layout-ui';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';
import { EditAppointmentComponent } from './public-appointments/edit-appointment/edit-appointment.component';
import { PickEmployeeComponent } from './public-appointments/pick-employee/pick-employee.component';
import { AppointmentFormComponent } from './public-appointments/appointment-form/appointment-form.component';
import { ConfirmAppointmentComponent } from './public-appointments/confirm-appointment/confirm-appointment.component';
import { PublicAppointmentsComponent } from './public-appointments/public-appointments.component';
import { AppointmentModule } from '../pages/employees/appointment/appointment.module';
import { CreateAppointmentComponent } from './public-appointments/create-appointment/create-appointment.component';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule.forRoot(),
	NbUserModule
];

@NgModule({
	imports: [
		...NB_MODULES,
		TranslateModule.forChild(),
		ShareRoutingModule,
		MiscellaneousModule,
		ThemeModule,
		SharedModule,
		TableComponentsModule,
		WorkInProgressModule,
		ImageUploaderModule,
		SelectorsModule,
		PublicLayoutModule,
		ManageAppointmentModule,
		AppointmentModule
	],
	declarations: [
		ShareComponent,
		EditAppointmentComponent,
		PublicAppointmentsComponent,
		PickEmployeeComponent,
		AppointmentFormComponent,
		ConfirmAppointmentComponent,
		CreateAppointmentComponent
	],
	providers: []
})
export class ShareModule {}

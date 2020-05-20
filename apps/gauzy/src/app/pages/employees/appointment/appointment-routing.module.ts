import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppointmentComponent } from './appointment.component';
import { ManageAppointmentComponent } from './manage-appointment/manage-appointment.component';
const routes: Routes = [
	{
		path: '',
		component: AppointmentComponent
	},
	{
		path: 'manage',
		component: ManageAppointmentComponent
	},
	{
		path: 'manage/:id',
		component: ManageAppointmentComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AppointmentRoutingModule {}

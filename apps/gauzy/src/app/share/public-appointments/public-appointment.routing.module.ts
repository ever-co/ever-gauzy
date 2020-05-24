import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PublicAppointmentsComponent } from './public-appointments.component';

const routes: Routes = [
	{
		path: '',
		component: PublicAppointmentsComponent,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class PublicAppointmentRoutingModule {}

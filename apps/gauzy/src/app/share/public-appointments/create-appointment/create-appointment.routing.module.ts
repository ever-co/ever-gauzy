import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CreateAppointmentComponent } from './create-appointment.component';
const routes: Routes = [
	{
		path: '',
		component: CreateAppointmentComponent,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class CreateAppointmentRoutingModule {}

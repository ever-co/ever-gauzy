import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfirmAppointmentComponent } from './confirm-appointment.component';
const routes: Routes = [
	{
		path: '',
		component: ConfirmAppointmentComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ConfirmAppointmentRoutingModule {}

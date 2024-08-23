import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { NotFoundComponent } from '@gauzy/ui-core/shared';
import {
	EmployeeComponent,
	InvoiceEstimateViewComponent,
	OrganizationComponent,
	PublicEmployeeResolver,
	PublicOrganizationResolver
} from '@gauzy/plugin-public-layout-ui';
import { ShareComponent } from './share.component';
import { EditAppointmentComponent } from './public-appointments/edit-appointment/edit-appointment.component';
import { PickEmployeeComponent } from './public-appointments/pick-employee/pick-employee.component';
import { AppointmentFormComponent } from './public-appointments/appointment-form/appointment-form.component';
import { ConfirmAppointmentComponent } from './public-appointments/confirm-appointment/confirm-appointment.component';
import { PublicAppointmentsComponent } from './public-appointments/public-appointments.component';
import { CreateAppointmentComponent } from './public-appointments/create-appointment/create-appointment.component';

const routes: Routes = [
	{
		path: '',
		component: ShareComponent,
		children: [
			{
				path: 'organization/:profileLink/:organizationId',
				children: [
					{
						path: '',
						component: OrganizationComponent,
						data: {
							relations: ['skills', 'awards', 'languages', 'languages.language']
						},
						resolve: {
							organization: PublicOrganizationResolver
						},
						runGuardsAndResolvers: 'always'
					},
					{
						path: ':slug/:employeeId',
						component: EmployeeComponent,
						data: {
							relations: []
						},
						resolve: {
							organization: PublicOrganizationResolver,
							employee: PublicEmployeeResolver
						},
						runGuardsAndResolvers: 'always'
					}
				]
			},
			{
				path: 'employee',
				children: [
					{
						path: '',
						component: PickEmployeeComponent
					},
					{
						path: 'edit-appointment',
						component: EditAppointmentComponent
					},
					{
						path: ':id',
						children: [
							{
								path: '',
								component: PublicAppointmentsComponent
							},
							{
								path: 'confirm/:appointmentId',
								component: ConfirmAppointmentComponent
							},
							{
								path: 'create-appointment',
								component: AppointmentFormComponent
							},
							{
								path: ':eventId',
								component: CreateAppointmentComponent
							}
						]
					}
				]
			},
			{
				path: ':type/:id/:token',
				component: InvoiceEstimateViewComponent,
				children: []
			},
			{
				path: '**',
				component: NotFoundComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ShareRoutingModule {}

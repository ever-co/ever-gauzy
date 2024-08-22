import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { NotFoundComponent } from '@gauzy/ui-core/shared';
import { PublicEmployeeResolver, PublicOrganizationResolver } from '@gauzy/plugin-public-layout-ui';
import { ShareComponent } from './share.component';
import { OrganizationComponent } from './organization/organization.component';
import { EmployeeComponent } from './employee/employee.component';

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
				path: 'employee/edit-appointment',
				loadChildren: () =>
					import('./public-appointments/edit-appointment/edit-appointment.module').then(
						(m) => m.EditAppointmentModule
					)
			},
			{
				path: 'employee',
				loadChildren: () =>
					import('./public-appointments/pick-employee/pick-employee.module').then((m) => m.PickEmployeeModule)
			},
			{
				path: 'employee/:id',
				loadChildren: () =>
					import('./public-appointments/public-appointments.module').then((m) => m.PublicAppointmentsModule)
			},
			{
				path: 'employee/:id/confirm/:appointmentId',
				loadChildren: () =>
					import('./public-appointments/confirm-appointment/confirm-appointment.module').then(
						(m) => m.ConfirmAppointmentModule
					)
			},
			{
				path: 'employee/:employeeId/create-appointment',
				loadChildren: () =>
					import('./public-appointments/appointment-form/appointment-form.module').then(
						(m) => m.AppointmentFormModule
					)
			},
			{
				path: 'employee/:id/:eventId',
				loadChildren: () =>
					import('./public-appointments/create-appointment/create-appointment.module').then(
						(m) => m.CreateAppointmentModule
					)
			},
			{
				path: 'invoices/:id/:token',
				loadChildren: () =>
					import('./invoices-estimates/invoice-estimate.module').then((m) => m.InvoiceEstimateModule)
			},
			{
				path: 'estimates/:id/:token',
				loadChildren: () =>
					import('./invoices-estimates/invoice-estimate.module').then((m) => m.InvoiceEstimateModule)
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

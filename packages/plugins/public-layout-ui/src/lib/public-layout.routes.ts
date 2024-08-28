import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { NotFoundComponent } from '@gauzy/ui-core/shared';
import {
	AppointmentFormComponent,
	ConfirmAppointmentComponent,
	CreateAppointmentComponent,
	EditAppointmentComponent,
	EmployeeComponent,
	InvoiceEstimateViewComponent,
	OrganizationComponent,
	PickEmployeeComponent,
	PublicAppointmentComponent,
	PublicLayoutComponent
} from './components';
import { PublicEmployeeResolver } from './resolvers/public-employee.resolver';
import { PublicOrganizationResolver } from './resolvers/public-organization.resolver';

/**
 * Creates public layout routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createPublicLayoutRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: PublicLayoutComponent,
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
								component: PublicAppointmentComponent
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

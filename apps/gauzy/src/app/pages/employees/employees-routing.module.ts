import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeesComponent } from './employees.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EditEmployeeMainComponent } from './edit-employee/edit-employee-profile/edit-employee-main/edit-employee-main.component';
import { EditEmployeeRatesComponent } from './edit-employee/edit-employee-profile/edit-employee-rate/edit-employee-rate.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { EditEmployeeProjectsComponent } from './edit-employee/edit-employee-profile/edit-employee-projects/edit-employee-projects.component';
import { EditEmployeeContactComponent } from './edit-employee/edit-employee-profile/edit-employee-contact/edit-employee-contact.component';
import { PermissionsEnum } from '@gauzy/contracts';
import { InviteGuard } from '../../@core/guards';
import { EditEmployeeHiringComponent } from './edit-employee/edit-employee-profile/edit-employee-hiring/edit-employee-hiring.component';
import { EditEmployeeLocationComponent } from './edit-employee/edit-employee-profile/edit-employee-location/edit-employee-location.component';
import { EditEmployeeEmploymentComponent } from './edit-employee/edit-employee-profile/edit-employee-employment/edit-employee-employment.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { EditEmployeeNetworksComponent } from './edit-employee/edit-employee-profile/edit-employee-networks/edit-employee-networks.component';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: EmployeesComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_VIEW],
				redirectTo
			},
			selectors: {
				project: false
			}
		}
	},
	{
		path: 'edit/:id',
		component: EditEmployeeComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_EDIT],
				redirectTo
			}
		},
		children: [
			{
				path: '',
				redirectTo: 'account',
				pathMatch: 'full'
			},
			{
				path: 'account',
				component: EditEmployeeMainComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'networks',
				component: EditEmployeeNetworksComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'rates',
				component: EditEmployeeRatesComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'projects',
				component: EditEmployeeProjectsComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'contacts',
				component: EditEmployeeContactComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'location',
				component: EditEmployeeLocationComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'hiring',
				component: EditEmployeeHiringComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'employment',
				component: EditEmployeeEmploymentComponent,
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					}
				}
			}
		]
	},
	{
		path: 'invites',
		component: ManageEmployeeInviteComponent,
		canActivate: [InviteGuard],
		data: {
			expectedPermissions: [
				PermissionsEnum.ORG_INVITE_EDIT,
				PermissionsEnum.ORG_INVITE_VIEW
			]
		}
	},
	{
		path: 'timesheets',
		loadChildren: () =>
			import('./timesheet/timesheet.module').then(
				(m) => m.TimesheetModule
			)
	},
	{
		path: 'activity',
		loadChildren: () =>
			import('./activity/activity.module').then((m) => m.ActivityModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeesRoutingModule {}

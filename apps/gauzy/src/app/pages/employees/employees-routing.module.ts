import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeesComponent } from './employees.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EditEmployeeProfileComponent } from './edit-employee/edit-employee-profile/edit-employee-profile.component';
import { EditEmployeeMainComponent } from './edit-employee/edit-employee-profile/edit-employee-main/edit-employee-main.component';
import { EditEmployeeRatesComponent } from './edit-employee/edit-employee-profile/edit-employee-rate/edit-employee-rate.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { EditEmployeeProjectsComponent } from './edit-employee/edit-employee-profile/edit-employee-projects/edit-employee-projects.component';
import { EditEmployeeClientComponent } from './edit-employee/edit-employee-profile/edit-employee-client/edit-employee-client.component';
import { PermissionsEnum } from '@gauzy/models';
import { InviteGuard } from '../../@core/role/invite.guard';
import { EditEmployeeHiringComponent } from './edit-employee/edit-employee-profile/edit-employee-hiring/edit-employee-hiring.component';
import { EditEmployeeLocationComponent } from './edit-employee/edit-employee-profile/edit-employee-location/edit-employee-location.component';
import { EditEmployeeEmploymentComponent } from './edit-employee/edit-employee-profile/edit-employee-employment/edit-employee-employment.component';

const routes: Routes = [
	{
		path: '',
		component: EmployeesComponent
	},
	{
		path: 'edit/:id',
		component: EditEmployeeComponent
	},
	{
		path: 'edit/:id/profile',
		component: EditEmployeeProfileComponent,
		children: [
			{
				path: '',
				redirectTo: 'account',
				pathMatch: 'full'
			},
			{
				path: 'account',
				component: EditEmployeeMainComponent
			},
			{
				path: 'rates',
				component: EditEmployeeRatesComponent
			},
			{
				path: 'projects',
				component: EditEmployeeProjectsComponent
			},
			{
				path: 'clients',
				component: EditEmployeeClientComponent
			},
			{
				path: 'location',
				component: EditEmployeeLocationComponent
			},
			{
				path: 'hiring',
				component: EditEmployeeHiringComponent
			},
			{
				path: 'employment',
				component: EditEmployeeEmploymentComponent
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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeesRoutingModule {}

import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeesComponent } from './employees.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EditEmployeeProfileComponent } from './edit-employee/edit-employee-profile/edit-employee-profile.component';
import { EditEmployeeMainComponent } from './edit-employee/edit-employee-profile/edit-employee-main/edit-employee-main.component';
import { EditEmployeeRatesComponent } from './edit-employee/edit-employee-profile/edit-employee-rate/edit-employee-rate.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { EditEmployeeDepartmentComponent } from './edit-employee/edit-employee-profile/edit-employee-department/edit-employee-department.component';
import { EditEmployeeProjectsComponent } from './edit-employee/edit-employee-profile/edit-employee-projects/edit-employee-projects.component';
import { EditEmployeeClientComponent } from './edit-employee/edit-employee-profile/edit-employee-client/edit-employee-client.component';
import { PermissionsEnum } from '@gauzy/models';
import { InviteGuard } from '../../@core/role/invite.guard';
import { EditEmployeeHiringComponent } from './edit-employee/edit-employee-profile/edit-employee-hiring/edit-employee-hiring.component';

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
				redirectTo: 'main',
				pathMatch: 'full'
			},
			{
				path: 'main',
				component: EditEmployeeMainComponent
			},
			{
				path: 'rates',
				component: EditEmployeeRatesComponent
			},
			{
				path: 'departments',
				component: EditEmployeeDepartmentComponent
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
				path: 'hiring',
				component: EditEmployeeHiringComponent
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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeesRoutingModule {}

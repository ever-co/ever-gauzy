import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeesComponent } from './employees.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EditEmployeeProfileComponent } from './edit-employee/edit-employee-profile/edit-employee-profile.component';
import { EditEmployeeMainComponent } from './edit-employee/edit-employee-profile/edit-employee-main/edit-employee-main.component';
import { EditEmployeeRatesComponent } from './edit-employee/edit-employee-profile/edit-employee-rate/edit-employee-rate.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';

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
			}
		]
	},
	{
		path: 'invites',
		component: ManageEmployeeInviteComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeesRoutingModule {}

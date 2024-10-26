import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { InviteGuard, PermissionsGuard } from '@gauzy/ui-core/core';
import { EmployeesComponent } from './employees.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import {
	EditEmployeeContactComponent,
	EditEmployeeEmploymentComponent,
	EditEmployeeHiringComponent,
	EditEmployeeLocationComponent,
	EditEmployeeMainComponent,
	EditEmployeeNetworksComponent,
	EditEmployeeOtherSettingsComponent,
	EditEmployeeProjectsComponent,
	EditEmployeeRatesComponent
} from './edit-employee/edit-employee-profile';
import { EmployeeResolver } from './employee.resolver';

const selectors = {
	team: false,
	project: false,
	employee: false,
	date: false,
	organization: false
};

const routes: Routes = [
	{
		path: '',
		component: EmployeesComponent,
		canActivate: [PermissionsGuard],
		data: {
			// The data table identifier for the route
			dataTableId: 'employee-manage',
			// The permission required to access the route
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_VIEW],
				redirectTo: '/pages/dashboard'
			},
			// The selectors for the route
			selectors: {
				team: false,
				project: false,
				employee: false,
				date: false
			}
		}
	},
	{
		path: 'edit/:id',
		component: EditEmployeeComponent,
		canActivate: [PermissionsGuard],
		data: {
			// The tabset identifier for the route
			tabsetId: 'employee-edit',
			// The permission required to access the route
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.PROFILE_EDIT],
				redirectTo: '/pages/dashboard'
			},
			// The selectors for the route
			selectors
		},
		resolve: { employee: EmployeeResolver },
		children: [
			{
				path: '',
				redirectTo: 'account',
				pathMatch: 'full'
			},
			{
				path: 'account',
				component: EditEmployeeMainComponent,
				data: { selectors }
			},
			{
				path: 'networks',
				component: EditEmployeeNetworksComponent,
				data: { selectors }
			},
			{
				path: 'rates',
				component: EditEmployeeRatesComponent,
				data: { selectors }
			},
			{
				path: 'projects',
				component: EditEmployeeProjectsComponent,
				canActivate: [PermissionsGuard],
				data: {
					// The selectors for the route
					selectors,
					// The permission required to access the route
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW],
						redirectTo: '/pages/dashboard'
					}
				}
			},
			{
				path: 'contacts',
				component: EditEmployeeContactComponent,
				data: { selectors }
			},
			{
				path: 'location',
				component: EditEmployeeLocationComponent,
				data: { selectors }
			},
			{
				path: 'hiring',
				component: EditEmployeeHiringComponent,
				data: { selectors }
			},
			{
				path: 'employment',
				component: EditEmployeeEmploymentComponent,
				data: { selectors }
			},
			{
				path: 'settings',
				component: EditEmployeeOtherSettingsComponent,
				data: { selectors }
			}
		]
	},
	{
		path: 'invites',
		component: ManageEmployeeInviteComponent,
		canActivate: [InviteGuard],
		data: {
			expectedPermissions: [PermissionsEnum.ORG_INVITE_EDIT, PermissionsEnum.ORG_INVITE_VIEW],
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	},
	{
		path: 'timesheets',
		loadChildren: () => import('./timesheet/timesheet.module').then((m) => m.TimesheetModule)
	},
	{
		path: 'activity',
		loadChildren: () => import('./activity/activity.module').then((m) => m.ActivityModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeesRoutingModule {}

import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { InviteGuard, PermissionsGuard } from '@gauzy/ui-sdk/core';
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
import { EditEmployeeResolver } from './edit-employee';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: EmployeesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_VIEW],
				redirectTo
			},
			selectors: {
				project: false,
				employee: false,
				date: false,
				team: false
			}
		}
	},
	{
		path: 'edit/:id',
		component: EditEmployeeComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.PROFILE_EDIT],
				redirectTo
			}
		},
		resolve: {
			employee: EditEmployeeResolver
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
				canActivate: [PermissionsGuard],
				data: {
					selectors: {
						project: false,
						organization: false,
						date: false
					},
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW],
						redirectTo
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
			},
			{
				path: 'settings',
				component: EditEmployeeOtherSettingsComponent,
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

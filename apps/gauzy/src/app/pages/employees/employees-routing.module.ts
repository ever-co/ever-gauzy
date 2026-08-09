import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { InviteGuard, PermissionsGuard } from '@gauzy/ui-core/core';
import { EmployeesComponent } from './employees.component';
import { ManageEmployeeInviteComponent } from './manage-employee-invite/manage-employee-invite.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import {
	EditEmployeeContactComponent,
	EditEmployeeDocumentsComponent,
	EditEmployeeEmploymentComponent,
	EditEmployeeHiringComponent,
	EditEmployeeLocationComponent,
	EditEmployeeMainComponent,
	EditEmployeeNetworksComponent,
	EditEmployeeOtherSettingsComponent,
	EditEmployeeProjectsComponent,
	EditEmployeeRatesComponent
} from './edit-employee/edit-employee-profile';
import { EmployeeResolver, EmployeeViewResolver } from './employee.resolver';
import { ViewEmployeeComponent } from './view-employee/view-employee.component';

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
			dataTableId: 'employee-manage-page',
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
		// Read-only View. An employee is a large record, so it gets a page rather
		// than a drawer; the guard is the same one that gates the Manage Employees
		// list it is opened from, so it shows nothing new.
		path: 'view/:id',
		component: ViewEmployeeComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_EMPLOYEES_VIEW],
				redirectTo: '/pages/dashboard'
			},
			selectors
		},
		resolve: { employee: EmployeeViewResolver }
	},
	{
		path: 'edit/:id',
		component: EditEmployeeComponent,
		canActivate: [PermissionsGuard],
		data: {
			// The tabset identifier for the route
			tabsetId: 'employee-edit-page',
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
			},
			{
				// Record-side Documents panel (spec 00 §6.14 R-LNK-02). Deliberately
				// NOT permission-guarded here: the panel gates itself on DOCS_READ +
				// FEATURE_DOCUMENTS, and a route guard would redirect the whole
				// employee page to the dashboard instead of hiding one tab.
				path: 'documents',
				component: EditEmployeeDocumentsComponent,
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

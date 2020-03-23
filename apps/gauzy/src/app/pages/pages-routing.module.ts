import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';

import { PagesComponent } from './pages.component';
import { NotFoundComponent } from './miscellaneous/not-found/not-found.component';
// import { RoleGuard } from '../@core/role/role.guard';
// import { RolesEnum } from '@gauzy/models';

const routes: Routes = [
	{
		path: '',
		component: PagesComponent,
		children: [
			{
				path: '',
				redirectTo: 'dashboard',
				pathMatch: 'full'
			},
			{
				path: 'dashboard',
				loadChildren: () =>
					import('./dashboard/dashboard.module').then(
						(m) => m.DashboardModule
					)
				//   ,
				// canActivate: [RoleGuard],
				// data: { expectedRole: [] }
				// data: { expectedRole: [RolesEnum.ADMIN] }
			},
			{
				path: 'income',
				loadChildren: () =>
					import('./income/income.module').then((m) => m.IncomeModule)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.DATA_ENTRY,
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'expenses',
				loadChildren: () =>
					import('./expenses/expenses.module').then(
						(m) => m.ExpensesModule
					)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.DATA_ENTRY,
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'integrations',
				loadChildren: () =>
					import('./integrations/integrations.module').then(
						(m) => m.IntegrationsModule
					)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.DATA_ENTRY,
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'proposals',
				loadChildren: () =>
					import('./proposals/proposals.module').then(
						(m) => m.ProposalsModule
					)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.DATA_ENTRY,
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'time-off',
				loadChildren: () =>
					import('./time-off/time-off.module').then(
						(m) => m.TimeOffModule
					)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'tags',
				loadChildren: () =>
					import('./tags/tags.module').then((m) => m.TagsModule)
			},
			{
				path: 'tasks',
				loadChildren: () =>
					import('./tasks/tasks.module').then((m) => m.TasksModule)
			},
			{
				path: 'help',
				loadChildren: () =>
					import('./help/help.module').then((m) => m.HelpModule)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.DATA_ENTRY,
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'about',
				loadChildren: () =>
					import('./about/about.module').then((m) => m.AboutModule)
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		// RolesEnum.DATA_ENTRY,
				// 		// RolesEnum.EMPLOYEE,
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'employees',
				loadChildren: () =>
					import('./employees/employees.module').then(
						(m) => m.EmployeesModule
					)
				// canActivate: [RoleGuard],
				// data: { expectedRole: [RolesEnum.ADMIN] }
			},
			{
				path: 'users',
				loadChildren: () =>
					import('./users/users.module').then((m) => m.UsersModule)
				// canActivate: [RoleGuard],
				// data: { expectedRole: [RolesEnum.ADMIN] }
			},
			{
				path: 'organizations',
				loadChildren: () =>
					import('./organizations/organizations.module').then(
						(m) => m.OrganizationsModule
					)
				// canActivate: [RoleGuard],
				// data: { expectedRole: [RolesEnum.ADMIN] }
			},
			{
				path: 'import-export',
				loadChildren: () =>
					import('./import-export/import-export.module').then(
						(m) => m.DownloadModule
					)
			},
			{
				path: 'auth',
				loadChildren: () =>
					import('./auth/auth.module').then((m) => m.AuthModule)
			},
			{
				path: 'settings',
				loadChildren: () =>
					import('./settings/settings.module').then(
						(m) => m.SettingsModule
					)
			},
			{
				path: 'equipment',
				loadChildren: () =>
					import('./equipment/equipment.module').then(
						(m) => m.EquipmentModule
					)
			},
			{
				path: 'equipment-sharing',
				loadChildren: () =>
					import('./equipment-sharing/equipment-sharing.module').then(
						(m) => m.EquipmentSharingModule
					)
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
export class PagesRoutingModule {}

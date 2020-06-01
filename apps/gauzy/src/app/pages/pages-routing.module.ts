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
				// canActivate: [RoleGuard],
				// data: {
				// 	expectedRole: [
				// 		RolesEnum.ADMIN
				// 	]
				// }
			},
			{
				path: 'dashboard',
				loadChildren: () =>
					import('./dashboard/dashboard.module').then(
						(m) => m.DashboardModule
					)
			},
			{
				path: 'accounting',
				children: [
					{
						path: '',
						redirectTo: 'invoices',
						pathMatch: 'full'
					},
					{
						path: 'income',
						loadChildren: () =>
							import('./income/income.module').then(
								(m) => m.IncomeModule
							)
					},
					{
						path: 'expenses',
						loadChildren: () =>
							import('./expenses/expenses.module').then(
								(m) => m.ExpensesModule
							)
					},
					{
						path: 'invoices',
						loadChildren: () =>
							import('./invoices/invoices.module').then(
								(m) => m.InvoicesModule
							)
					},
					{
						path: 'recurring-invoices',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					},
					{
						path: 'payments',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					}
				]
			},
			{
				path: 'clients',
				loadChildren: () =>
					import('./work-in-progress/work-in-progress.module').then(
						(m) => m.WorkInProgressModule
					)
			},
			{
				path: 'projects',
				loadChildren: () =>
					import('./work-in-progress/work-in-progress.module').then(
						(m) => m.WorkInProgressModule
					)
			},
			{
				path: 'tasks',
				children: [
					{
						path: '',
						redirectTo: 'dashboard',
						pathMatch: 'full'
					},
					{
						path: 'dashboard',
						loadChildren: () =>
							import('./tasks/tasks.module').then(
								(m) => m.TasksModule
							)
					},
					{
						path: 'me',
						loadChildren: () =>
							import('./my-tasks/my-tasks.module').then(
								(m) => m.MyTasksModule
							)
					},
					{
						path: 'team',
						loadChildren: () =>
							import('./team-tasks/team-tasks.module').then(
								(m) => m.TeamTasksModule
							)
					}
				]
			},
			{
				path: 'sales',
				children: [
					{
						path: 'proposals',
						loadChildren: () =>
							import('./proposals/proposals.module').then(
								(m) => m.ProposalsModule
							)
					},
					{
						path: 'estimates',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					},
					{
						path: 'invoices',
						loadChildren: () =>
							import('./invoices/invoices.module').then(
								(m) => m.InvoicesModule
							)
					},
					{
						path: 'recurring-invoices',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					},
					{
						path: 'payments',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					}
				]
			},
			{
				path: 'employees',
				children: [
					{
						path: '',
						loadChildren: () =>
							import('./employees/employees.module').then(
								(m) => m.EmployeesModule
							)
					},
					{
						path: 'activity',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					},
					{
						path: 'timesheets',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					},
					{
						path: 'schedules',
						loadChildren: () =>
							import(
								'./employees/schedules/schedule.module'
							).then((m) => m.ScheduleModule)
					},
					{
						path: 'appointments',
						loadChildren: () =>
							import(
								'./employees/appointment/appointment.module'
							).then((m) => m.AppointmentModule)
					},
					{
						path: 'event-types',
						loadChildren: () =>
							import(
								'./employees/event-types/event-type.module'
							).then((m) => m.EventTypeModule)
					},
					{
						path: 'time-off',
						loadChildren: () =>
							import('./time-off/time-off.module').then(
								(m) => m.TimeOffModule
							)
					},
					{
						path: 'approvals',
						loadChildren: () =>
							import('./approvals/approvals.module').then(
								(m) => m.ApprovalsModule
							)
					},
					{
						path: 'candidates',
						loadChildren: () =>
							import('./candidates/candidates.module').then(
								(m) => m.CandidatesModule
							)
					}
				]
			},
			{
				path: 'organization',
				children: [
					{
						path: 'equipment',
						loadChildren: () =>
							import('./equipment/equipment.module').then(
								(m) => m.EquipmentModule
							)
					},
					{
						path: 'inventory',
						loadChildren: () =>
							import('./inventory/inventory.module').then(
								(m) => m.InventoryModule
							)
					},
					{
						path: 'tags',
						loadChildren: () =>
							import('./tags/tags.module').then(
								(m) => m.TagsModule
							)
					},
					{
						path: 'email-templates',
						loadChildren: () =>
							import(
								'./email-templates/email-templates.module'
							).then((m) => m.EmailTemplatesModule)
					},
					{
						path: 'help-center',
						loadChildren: () =>
							import('./help-center/help-center.module').then(
								(m) => m.HelpCenterModule
							)
					},
					{
						path: 'equipment-sharing',
						loadChildren: () =>
							import(
								'./equipment-sharing/equipment-sharing.module'
							).then((m) => m.EquipmentSharingModule)
					}
				]
			},
			{
				path: 'reports',
				children: [
					{
						path: '',
						redirectTo: 'time',
						pathMatch: 'full'
					},
					{
						path: 'time',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					},
					{
						path: 'accounting',
						loadChildren: () =>
							import(
								'./work-in-progress/work-in-progress.module'
							).then((m) => m.WorkInProgressModule)
					}
				]
			},
			{
				path: 'help',
				loadChildren: () =>
					import('./help/help.module').then((m) => m.HelpModule)
			},
			{
				path: 'about',
				loadChildren: () =>
					import('./about/about.module').then((m) => m.AboutModule)
			},
			{
				path: 'integrations',
				loadChildren: () =>
					import('./integrations/integrations.module').then(
						(m) => m.IntegrationsModule
					)
			},
			{
				path: 'candidates',
				loadChildren: () =>
					import('./candidates/candidates.module').then(
						(m) => m.CandidatesModule
					)
				// canActivate: [RoleGuard],
				// data: { expectedRole: [RolesEnum.ADMIN] }
			},
			{
				path: 'users',
				loadChildren: () =>
					import('./users/users.module').then((m) => m.UsersModule)
			},
			{
				path: 'organizations',
				loadChildren: () =>
					import('./organizations/organizations.module').then(
						(m) => m.OrganizationsModule
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

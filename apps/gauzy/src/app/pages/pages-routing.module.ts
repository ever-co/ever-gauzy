import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard, UserResolver } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { DateRangePickerResolver, NotFoundComponent } from '@gauzy/ui-core/shared';
import { PagesComponent } from './pages.component';

const routes: Routes = [
	{
		path: '',
		component: PagesComponent,
		resolve: {
			user: UserResolver
		},
		children: [
			{
				path: '',
				redirectTo: 'dashboard',
				pathMatch: 'full'
			},
			{
				path: 'dashboard',
				loadChildren: () => import('./dashboard/dashboard.module').then((m) => m.DashboardModule)
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
						loadChildren: () => import('./income/income.module').then((m) => m.IncomeModule),
						data: {
							selectors: {
								project: false,
								team: false
							},
							datePicker: {
								unitOfTime: 'month'
							}
						},
						resolve: { dates: DateRangePickerResolver }
					},
					{
						path: 'expenses',
						loadChildren: () => import('./expenses/expenses.module').then((m) => m.ExpensesModule),
						data: {
							datePicker: {
								unitOfTime: 'month'
							}
						},
						resolve: { dates: DateRangePickerResolver }
					},
					{
						path: 'expense-recurring',
						loadChildren: () =>
							import('./expense-recurring/expense-recurring.module').then((m) => m.ExpenseRecurringModule)
					},
					{
						path: 'invoices',
						loadChildren: () => import('./invoices/invoices.module').then((m) => m.InvoicesModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false
							},
							datePicker: {
								unitOfTime: 'week'
							}
						}
					},
					{
						path: 'payments',
						loadChildren: () => import('./payments/payments.module').then((m) => m.PaymentsModule)
					}
				]
			},
			{
				path: 'contacts',
				loadChildren: () => import('./contacts/contacts.module').then((m) => m.ContactsModule)
			},
			{
				path: 'projects',
				loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: false
					}
				}
			},
			{
				path: 'tasks',
				loadChildren: () => import('./tasks/tasks.module').then((m) => m.TasksModule)
			},
			{
				path: 'jobs',
				loadChildren: () => import('./jobs/jobs.module').then((m) => m.JobsModule)
			},
			{
				path: 'sales',
				children: [
					{
						path: 'proposals',
						loadChildren: () => import('@gauzy/plugin-job-proposal-ui').then((m) => m.JobProposalModule)
					},
					{
						path: 'estimates',
						loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false,
								organization: false
							}
						}
					},
					{
						path: 'invoices',
						loadChildren: () => import('./invoices/invoices.module').then((m) => m.InvoicesModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false
							},
							datePicker: {
								unitOfTime: 'week'
							}
						},
						resolve: { dates: DateRangePickerResolver }
					},
					{
						path: 'payments',
						loadChildren: () => import('./payments/payments.module').then((m) => m.PaymentsModule),
						data: {
							selectors: {
								employee: false
							},
							datePicker: {
								unitOfTime: 'month'
							}
						},
						resolve: { dates: DateRangePickerResolver }
					},
					{
						path: 'pipelines',
						loadChildren: () => import('./pipelines/pipelines.module').then((m) => m.PipelinesModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					}
				]
			},
			{
				path: 'employees',
				children: [
					{
						path: '',
						loadChildren: () => import('./employees/employees.module').then((m) => m.EmployeesModule)
					},
					{
						path: 'schedules',
						loadChildren: () =>
							import('./employees/schedules/schedule.module').then((m) => m.ScheduleModule),
						data: {
							selectors: {
								project: false,
								team: false
							}
						}
					},
					{
						path: 'appointments',
						loadChildren: () =>
							import('./employees/appointment/appointment.module').then((m) => m.AppointmentModule),
						data: {
							selectors: {
								project: false,
								team: false
							},
							datePicker: {
								unitOfTime: 'week',
								isDisablePastDate: true
							}
						},
						resolve: { dates: DateRangePickerResolver }
					},
					{
						path: 'event-types',
						loadChildren: () =>
							import('./employees/event-types/event-type.module').then((m) => m.EventTypeModule),
						data: {
							selectors: {
								project: false,
								team: false
							}
						}
					},
					{
						path: 'time-off',
						loadChildren: () => import('./time-off/time-off.module').then((m) => m.TimeOffModule)
					},
					{
						path: 'approvals',
						loadChildren: () => import('./approvals/approvals.module').then((m) => m.ApprovalsModule),
						data: {
							selectors: {
								project: false,
								team: false
							}
						}
					},
					{
						path: 'positions',
						loadChildren: () => import('./positions/positions.module').then((m) => m.PositionsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'employee-level',
						loadChildren: () =>
							import('./employee-levels/employee-level.module').then((m) => m.EmployeeLevelModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'recurring-expenses',
						loadChildren: () =>
							import('./recurring-expense-employee/recurring-expense-employee.module').then(
								(m) => m.RecurringExpensesEmployeeModule
							)
					},
					{
						path: 'candidates',
						loadChildren: () => import('./candidates/candidates.module').then((m) => m.CandidatesModule)
					}
				]
			},
			{
				path: 'organization',
				children: [
					{
						path: 'equipment',
						loadChildren: () => import('./equipment/equipment.module').then((m) => m.EquipmentModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'equipment-sharing',
						loadChildren: () =>
							import('./equipment-sharing/equipment-sharing.module').then(
								(m) => m.EquipmentSharingModule
							),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: true,
								date: false
							}
						}
					},
					{
						path: 'equipment-sharing-policy',
						loadChildren: () =>
							import('./equipment-sharing-policy/equipment-sharing-policy.module').then(
								(m) => m.EquipmentSharingPolicyModule
							),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'inventory',
						loadChildren: () => import('./inventory/inventory.module').then((m) => m.InventoryModule)
					},
					{
						path: 'tags',
						loadChildren: () => import('./tags/tags.module').then((m) => m.TagsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'expense-recurring',
						loadChildren: () =>
							import('./expense-recurring/expense-recurring.module').then((m) => m.ExpenseRecurringModule)
					},
					{
						path: 'help-center',
						loadChildren: () => import('./help-center/help-center.module').then((m) => m.HelpCenterModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'approval-policy',
						loadChildren: () =>
							import('./approval-policy/approval-policy.module').then((m) => m.ApprovalPolicyModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},

					{
						path: 'documents',
						loadChildren: () => import('./documents/documents.module').then((m) => m.DocumentsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'employment-types',
						loadChildren: () =>
							import('./employment-types/employment-types.module').then((m) => m.EmploymentTypesModule)
					},
					{
						path: 'vendors',
						loadChildren: () => import('./vendors/vendors.module').then((m) => m.VendorsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					},
					{
						path: 'departments',
						loadChildren: () => import('./departments/departments.module').then((m) => m.DepartmentsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: true,
								date: true
							}
						}
					},
					{
						path: 'projects',
						loadChildren: () => import('./projects/projects.module').then((m) => m.ProjectsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: true,
								date: true
							}
						}
					},
					{
						path: 'teams',
						loadChildren: () => import('./teams/teams.module').then((m) => m.TeamsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: true,
								date: true
							}
						}
					}
				]
			},
			{
				path: 'goals',
				children: [
					{
						path: '',
						loadChildren: () => import('./goals/goals.module').then((m) => m.GoalsModule),
						data: {
							selectors: {
								project: false,
								team: false
							}
						}
					},
					{
						path: 'reports',
						loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false,
								organization: false
							}
						}
					},
					{
						path: 'settings',
						loadChildren: () =>
							import('./goal-settings/goal-settings.module').then((m) => m.GoalSettingsModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false
							}
						}
					}
				]
			},
			{
				path: 'reports',
				children: [
					{
						path: '',
						redirectTo: 'all',
						pathMatch: 'full'
					},
					{
						path: 'all',
						loadChildren: () =>
							import('./reports/all-report/all-report.module').then((m) => m.AllReportModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false,
								organization: true
							}
						}
					},
					{
						path: 'time-activity',
						loadChildren: () =>
							import('./reports/time-reports/time-reports.module').then((m) => m.TimeReportsModule)
					},
					{
						path: 'weekly',
						loadChildren: () =>
							import('./reports/weekly-time-reports/weekly-time-reports.module').then(
								(m) => m.WeeklyTimeReportsModule
							)
					},
					{
						path: 'apps-urls',
						loadChildren: () =>
							import('./reports/apps-urls-report/apps-urls-report.module').then(
								(m) => m.AppsUrlsReportModule
							)
					},
					{
						path: 'manual-time-edits',
						loadChildren: () =>
							import('./reports/manual-time/manual-time.module').then((m) => m.ManualTimeModule)
					},
					{
						path: 'accounting',
						loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
						data: {
							selectors: {
								project: false,
								team: false,
								employee: false,
								date: false,
								organization: false
							}
						}
					},
					{
						path: 'expense',
						loadChildren: () =>
							import('./reports/expenses-report/expenses-report.module').then(
								(m) => m.ExpensesReportModule
							)
					},
					{
						path: 'payments',
						loadChildren: () =>
							import('./reports/payment-report/payment-report.module').then((m) => m.PaymentReportModule)
					},
					{
						path: 'amounts-owed',
						loadChildren: () =>
							import('./reports/amounts-owed-report/amounts-owed-report.module').then(
								(m) => m.AmountsOwedReportModule
							)
					},
					{
						path: 'weekly-limits',
						loadChildren: () =>
							import('./reports/time-limit-report/time-limit-report.module').then(
								(m) => m.TimeLimitReportModule
							)
					},
					{
						path: 'daily-limits',
						loadChildren: () =>
							import('./reports/time-limit-report/time-limit-report.module').then(
								(m) => m.TimeLimitReportModule
							)
					},
					{
						path: 'project-budgets',
						loadChildren: () =>
							import('./reports/project-budgets-report/project-budgets-report.module').then(
								(m) => m.ProjectBudgetsReportModule
							)
					},
					{
						path: 'client-budgets',
						loadChildren: () =>
							import('./reports/client-budgets-report/client-budgets-report.module').then(
								(m) => m.ClientBudgetsReportModule
							)
					},
					{
						path: '*',
						component: NotFoundComponent
					}
				]
			},
			{
				path: 'help',
				loadChildren: () => import('./help/help.module').then((m) => m.HelpModule)
			},
			{
				path: 'about',
				loadChildren: () => import('./about/about.module').then((m) => m.AboutModule)
			},
			{
				path: 'integrations',
				loadChildren: () => import('./integrations/integrations.module').then((m) => m.IntegrationsModule),
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT],
						redirectTo: '/pages/dashboard'
					},
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: true
					}
				}
			},
			{
				path: 'candidates',
				loadChildren: () => import('./candidates/candidates.module').then((m) => m.CandidatesModule)
			},
			{
				path: 'users',
				loadChildren: () => import('./users/users.module').then((m) => m.UsersModule),
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'organizations',
				loadChildren: () => import('./organizations/organizations.module').then((m) => m.OrganizationsModule)
			},
			{
				path: 'auth',
				loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule)
			},
			{
				path: 'settings',
				loadChildren: () => import('./settings/settings.module').then((m) => m.SettingsModule)
			},
			{
				path: 'legal',
				loadChildren: () => import('@gauzy/plugin-legal-ui').then((m) => m.PageLegalModule)
			},
			{
				path: '**',
				component: NotFoundComponent,
				data: {
					selectors: false
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PagesRoutingModule {}

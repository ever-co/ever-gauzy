import { Route, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryService, PermissionsGuard, UserResolver } from '@gauzy/ui-core/core';
import { DateRangePickerResolver, NotFoundComponent } from '@gauzy/ui-core/shared';
import { PagesComponent } from './pages.component';

/**
 * Builds pages routes for the application.
 *
 * Route order follows the main navigation. Keep RESERVED_PAGE_SECTION_PATHS in
 * page-route-registry.service.ts in sync with core paths.
 *
 * Plugin routes are merged dynamically from the page route registry:
 * - `page-sections`: Top-level sections under /pages (e.g. jobs)
 * - `sales-sections`: Children under /pages/sales (e.g. proposals)
 * - `accounting-sections`: Children under /pages/accounting
 * - `employees-sections`: Children under /pages/employees
 * - `organization-sections`: Children under /pages/organization
 * - `goals-sections`: Children under /pages/goals
 * - `reports-sections`: Children under /pages/reports
 *
 * Plugins register at bootstrap via PageRouteRegistryService.registerPageRoute().
 *
 * @param _pageRouteRegistryService PageRouteRegistryService for merging plugin routes
 */
export const getPagesRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Routes => {
	const children: Route[] = [
		...getRedirectRoute(),
		...getDashboardRoute(),
		...getAccountingRoutes(_pageRouteRegistryService),
		...getContactsRoute(),
		...getProjectsRoute(),
		...getTasksRoute(),
		...getSalesRoutes(_pageRouteRegistryService),
		...getEmployeesRoutes(_pageRouteRegistryService),
		...getOrganizationRoutes(_pageRouteRegistryService),
		...getGoalsRoutes(_pageRouteRegistryService),
		...getReportsRoutes(_pageRouteRegistryService),
		...getHelpRoute(),
		...getAboutRoute(),
		...getIntegrationsRoute(),
		...getCandidatesRoute(),
		...getUsersRoute(),
		...getOrganizationsRoute(),
		...getAuthRoute(),
		...getSettingsRoute(),
		...getLegalRoute(),
		..._pageRouteRegistryService.getPageLocationRoutes('page-sections'),
		...getNotFoundRoute() // Catch-all ** – must be last
	];

	return [
		{
			path: '',
			component: PagesComponent,
			resolve: { user: UserResolver },
			children
		}
	];
};

/** Redirects empty /pages to /pages/dashboard */
function getRedirectRoute(): Route[] {
	return [{ path: '', redirectTo: 'dashboard', pathMatch: 'full' }];
}

function getDashboardRoute(): Route[] {
	return [
		{
			path: 'dashboard',
			loadChildren: () => import('./dashboard/dashboard.module').then((m) => m.DashboardModule)
		}
	];
}

function getAccountingRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
		{
			path: 'accounting',
			children: [
				{ path: '', redirectTo: 'invoices', pathMatch: 'full' },
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
					resolve: {
						dates: DateRangePickerResolver
					}
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
						selectors: { project: false, team: false, employee: false },
						datePicker: { unitOfTime: 'month' }
					}
				},
				{
					path: 'payments',
					loadChildren: () => import('./payments/payments.module').then((m) => m.PaymentsModule)
				},
				..._pageRouteRegistryService.getPageLocationRoutes('accounting-sections')
			]
		}
	];
}

function getContactsRoute(): Route[] {
	return [
		{
			path: 'contacts',
			loadChildren: () => import('./contacts/contacts.module').then((m) => m.ContactsModule)
		}
	];
}

function getProjectsRoute(): Route[] {
	return [
		{
			path: 'projects',
			loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
			data: {
				selectors: { project: false, team: false, employee: false, date: false, organization: false }
			}
		}
	];
}

function getTasksRoute(): Route[] {
	return [
		{
			path: 'tasks',
			loadChildren: () => import('./tasks/tasks.module').then((m) => m.TasksModule)
		}
	];
}

/**
 * Gets the sales routes from the page route registry service.
 *
 * @param _pageRouteRegistryService PageRouteRegistryService
 * @returns Route[]
 */
function getSalesRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
		{
			path: 'sales',
			children: [
				{ path: '', redirectTo: 'invoices', pathMatch: 'full' },
				{
					path: 'estimates',
					loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
					data: {
						selectors: { project: false, team: false, employee: false, date: false, organization: false }
					}
				},
				{
					path: 'invoices',
					loadChildren: () => import('./invoices/invoices.module').then((m) => m.InvoicesModule),
					data: {
						selectors: { project: false, team: false, employee: false },
						datePicker: { unitOfTime: 'month' }
					},
					resolve: { dates: DateRangePickerResolver }
				},
				{
					path: 'payments',
					loadChildren: () => import('./payments/payments.module').then((m) => m.PaymentsModule),
					data: { employee: false, datePicker: { unitOfTime: 'month' } },
					resolve: { dates: DateRangePickerResolver }
				},
				{
					path: 'pipelines',
					loadChildren: () => import('./pipelines/pipelines.module').then((m) => m.PipelinesModule),
					data: { selectors: { project: false, team: false, employee: false, date: false } }
				},
				..._pageRouteRegistryService.getPageLocationRoutes('sales-sections')
			]
		}
	];
}

function getHelpRoute(): Route[] {
	return [
		{
			path: 'help',
			loadChildren: () => import('./help/help.module').then((m) => m.HelpModule)
		}
	];
}

function getAboutRoute(): Route[] {
	return [
		{
			path: 'about',
			loadChildren: () => import('./about/about.module').then((m) => m.AboutModule)
		}
	];
}

function getIntegrationsRoute(): Route[] {
	return [
		{
			path: 'integrations',
			loadChildren: () => import('./integrations/integrations.module').then((m) => m.IntegrationsModule),
			canActivate: [PermissionsGuard],
			data: {
				permissions: {
					only: [PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT],
					redirectTo: '/pages/dashboard'
				},
				selectors: { project: false, team: false, employee: false, date: false, organization: true }
			}
		}
	];
}

function getCandidatesRoute(): Route[] {
	return [
		{
			path: 'candidates',
			loadChildren: () => import('./candidates/candidates.module').then((m) => m.CandidatesModule)
		}
	];
}

function getUsersRoute(): Route[] {
	return [
		{
			path: 'users',
			loadChildren: () => import('./users/users.module').then((m) => m.UsersModule),
			data: { selectors: { project: false, team: false, employee: false, date: false } }
		}
	];
}

function getOrganizationsRoute(): Route[] {
	return [
		{
			path: 'organizations',
			loadChildren: () => import('./organizations/organizations.module').then((m) => m.OrganizationsModule)
		}
	];
}

function getAuthRoute(): Route[] {
	return [
		{
			path: 'auth',
			loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule)
		}
	];
}

function getSettingsRoute(): Route[] {
	return [
		{
			path: 'settings',
			loadChildren: () => import('./settings/settings.module').then((m) => m.SettingsModule)
		}
	];
}

function getLegalRoute(): Route[] {
	return [
		{
			path: 'legal',
			loadChildren: () => import('@gauzy/plugin-legal-ui').then((m) => m.PageLegalModule)
		}
	];
}

/** Catch-all for unmatched /pages/* – must be last in children */
function getNotFoundRoute(): Route[] {
	return [
		{
			path: '**',
			component: NotFoundComponent,
			data: { selectors: false }
		}
	];
}

function getEmployeesRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
		{
			path: 'employees',
			children: [
				{ path: '', loadChildren: () => import('./employees/employees.module').then((m) => m.EmployeesModule) },
				{
					path: 'schedules',
					loadChildren: () => import('./employees/schedules/schedule.module').then((m) => m.ScheduleModule),
					data: { selectors: { project: false, team: false } }
				},
				{
					path: 'appointments',
					loadChildren: () =>
						import('./employees/appointment/appointment.module').then((m) => m.AppointmentModule),
					data: {
						selectors: { project: false, team: false },
						datePicker: { unitOfTime: 'week', isDisablePastDate: true }
					},
					resolve: { dates: DateRangePickerResolver }
				},
				{
					path: 'event-types',
					loadChildren: () =>
						import('./employees/event-types/event-type.module').then((m) => m.EventTypeModule),
					data: { selectors: { project: false, team: false } }
				},
				{
					path: 'time-off',
					loadChildren: () => import('./time-off/time-off.module').then((m) => m.TimeOffModule)
				},
				{
					path: 'approvals',
					loadChildren: () => import('./approvals/approvals.module').then((m) => m.ApprovalsModule),
					data: { selectors: { project: false, team: false } }
				},
				{
					path: 'positions',
					loadChildren: () => import('./positions/positions.module').then((m) => m.PositionsModule),
					data: { selectors: { project: false, team: false, employee: false, date: false } }
				},
				{
					path: 'employee-level',
					loadChildren: () =>
						import('./employee-levels/employee-level.module').then((m) => m.EmployeeLevelModule),
					data: { selectors: { project: false, team: false, employee: false, date: false } }
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
				},
				..._pageRouteRegistryService.getPageLocationRoutes('employees-sections')
			]
		}
	];
}

function getOrganizationRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	const orgSelectors = { project: false, team: false, employee: false, date: false };
	return [
		{
			path: 'organization',
			children: [
				{
					path: 'equipment',
					loadChildren: () => import('./equipment/equipment.module').then((m) => m.EquipmentModule),
					data: { selectors: orgSelectors }
				},
				{
					path: 'equipment-sharing',
					loadChildren: () =>
						import('./equipment-sharing/equipment-sharing.module').then((m) => m.EquipmentSharingModule),
					data: { selectors: { ...orgSelectors, employee: true } }
				},
				{
					path: 'equipment-sharing-policy',
					loadChildren: () =>
						import('./equipment-sharing-policy/equipment-sharing-policy.module').then(
							(m) => m.EquipmentSharingPolicyModule
						),
					data: { selectors: orgSelectors }
				},
				{
					path: 'inventory',
					loadChildren: () => import('./inventory/inventory.module').then((m) => m.InventoryModule)
				},
				{
					path: 'tags',
					loadChildren: () => import('./tags/tags.module').then((m) => m.TagsModule),
					data: { selectors: orgSelectors }
				},
				{
					path: 'expense-recurring',
					loadChildren: () =>
						import('./expense-recurring/expense-recurring.module').then((m) => m.ExpenseRecurringModule)
				},
				{
					path: 'help-center',
					loadChildren: () => import('./help-center/help-center.module').then((m) => m.HelpCenterModule),
					data: { selectors: orgSelectors }
				},
				{
					path: 'approval-policy',
					loadChildren: () =>
						import('./approval-policy/approval-policy.module').then((m) => m.ApprovalPolicyModule),
					data: { selectors: orgSelectors }
				},
				{
					path: 'documents',
					loadChildren: () => import('./documents/documents.module').then((m) => m.DocumentsModule),
					data: { selectors: orgSelectors }
				},
				{
					path: 'employment-types',
					loadChildren: () =>
						import('./employment-types/employment-types.module').then((m) => m.EmploymentTypesModule)
				},
				{
					path: 'vendors',
					loadChildren: () => import('./vendors/vendors.module').then((m) => m.VendorsModule),
					data: { selectors: orgSelectors }
				},
				{
					path: 'departments',
					loadChildren: () => import('./departments/departments.module').then((m) => m.DepartmentsModule),
					data: { selectors: { ...orgSelectors, employee: true, date: true } }
				},
				{
					path: 'projects',
					loadChildren: () => import('./projects/projects.module').then((m) => m.ProjectsModule),
					data: { selectors: { ...orgSelectors, employee: true, date: true } }
				},
				{
					path: 'teams',
					loadChildren: () => import('./teams/teams.module').then((m) => m.TeamsModule),
					data: { selectors: { ...orgSelectors, employee: true, date: true } }
				},
				..._pageRouteRegistryService.getPageLocationRoutes('organization-sections')
			]
		}
	];
}

function getGoalsRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
		{
			path: 'goals',
			children: [
				{
					path: '',
					loadChildren: () => import('./goals/goals.module').then((m) => m.GoalsModule),
					data: { selectors: { project: false, team: false } }
				},
				{
					path: 'reports',
					loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule),
					data: {
						selectors: { project: false, team: false, employee: false, date: false, organization: false }
					}
				},
				{
					path: 'settings',
					loadChildren: () =>
						import('./goal-settings/goal-settings.module').then((m) => m.GoalSettingsModule),
					data: { selectors: { project: false, team: false, employee: false, date: false } }
				},
				..._pageRouteRegistryService.getPageLocationRoutes('goals-sections')
			]
		}
	];
}

function getReportsRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	const reportSelectors = { project: false, team: false, employee: false, date: false, organization: true };
	return [
		{
			path: 'reports',
			children: [
				{ path: '', redirectTo: 'all', pathMatch: 'full' },
				{
					path: 'all',
					loadChildren: () => import('./reports/all-report/all-report.module').then((m) => m.AllReportModule),
					data: { selectors: { ...reportSelectors, organization: true } }
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
						import('./reports/apps-urls-report/apps-urls-report.module').then((m) => m.AppsUrlsReportModule)
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
						selectors: { project: false, team: false, employee: false, date: false, organization: false }
					}
				},
				{
					path: 'expense',
					loadChildren: () =>
						import('./reports/expenses-report/expenses-report.module').then((m) => m.ExpensesReportModule)
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
				..._pageRouteRegistryService.getPageLocationRoutes('reports-sections'),
				{ path: '**', component: NotFoundComponent }
			]
		}
	];
}

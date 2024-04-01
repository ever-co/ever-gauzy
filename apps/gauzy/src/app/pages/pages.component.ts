import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Data, NavigationEnd, Router } from '@angular/router';
import {
	FeatureEnum,
	IOrganization,
	IRolePermission,
	IUser,
	IntegrationEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, map, tap } from 'rxjs/operators';
import { NgxPermissionsService } from 'ngx-permissions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { chain } from 'underscore';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { SelectorService } from '../@core/utils/selector.service';
import { IJobMatchingEntity, IntegrationEntitySettingServiceStoreService, IntegrationsService, Store, UsersService } from '../@core/services';
import { ReportService } from './reports/all-report/report.service';
import { AuthStrategy } from '../@core/auth/auth-strategy.service';
import { TranslationBaseComponent } from '../@shared/language-base';

interface GaMenuItem extends NbMenuItem {
	class?: string;
	data: {
		translationKey: string; //Translation key for the title, mandatory for all items
		permissionKeys?: PermissionsEnum[]; //Check permissions and hide item if any given permission is not present
		featureKey?: FeatureEnum; //Check permissions and hide item if any given permission is not present
		withOrganizationShortcuts?: boolean; //Declare if the sidebar item has organization level shortcuts
		hide?: () => boolean; //Hide the menu item if this returns true
	};
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-pages',
	styleUrls: ['pages.component.scss'],
	template: `
		<ngx-one-column-layout *ngIf="!!menu && user">
			<ga-sidebar-menu [items]="menu"></ga-sidebar-menu>
			<router-outlet></router-outlet>
		</ngx-one-column-layout>
	`
})
export class PagesComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	public isEmployeeJobMatchingEntity: boolean = false;
	public isEmployee: boolean;
	public organization: IOrganization;
	public user: IUser;
	public menu: NbMenuItem[] = [];
	public reportMenuItems: NbMenuItem[] = [];

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		public readonly translate: TranslateService,
		private readonly store: Store,
		private readonly reportService: ReportService,
		private readonly selectorService: SelectorService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly usersService: UsersService,
		private readonly authStrategy: AuthStrategy,
		private readonly _integrationsService: IntegrationsService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService
	) {
		super(translate);
	}

	getMenuItems(): GaMenuItem[] {
		return [
			{
				title: 'Dashboards',
				icon: 'fas fa-th',
				link: '/pages/dashboard',
				pathMatch: 'prefix',
				home: true,
				data: {
					translationKey: 'MENU.DASHBOARDS',
					featureKey: FeatureEnum.FEATURE_DASHBOARD
				}
			},
			{
				title: 'Focus',
				icon: 'fas fa-bullseye',
				link: '/pages/dashboard',
				pathMatch: 'prefix',
				class: 'focus',
				hidden: true,
				data: {
					translationKey: 'MENU.FOCUS',
					featureKey: FeatureEnum.FEATURE_DASHBOARD
				}
			},
			{
				title: 'Applications',
				icon: 'far fa-window-maximize',
				link: '/pages/dashboard',
				pathMatch: 'prefix',
				class: 'application',
				hidden: true,
				data: {
					translationKey: 'MENU.APPLICATIONS',
					featureKey: FeatureEnum.FEATURE_DASHBOARD
				}
			},
			{
				title: 'Accounting',
				icon: 'far fa-address-card',
				data: {
					translationKey: 'MENU.ACCOUNTING'
				},
				children: [
					{
						title: 'Estimates',
						icon: 'far fa-file',
						link: '/pages/accounting/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ESTIMATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_ESTIMATE,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ESTIMATES_EDIT)
								? { add: '/pages/accounting/invoices/estimates/add' }
								: {})
						}
					},
					{
						title: 'Estimates Received',
						icon: 'fas fa-file-invoice',
						link: '/pages/accounting/invoices/received-estimates',
						data: {
							translationKey: 'MENU.ESTIMATES_RECEIVED',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ESTIMATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_ESTIMATE_RECEIVED
						}
					},
					{
						title: 'Invoices',
						icon: 'far fa-file-alt',
						link: '/pages/accounting/invoices',
						pathMatch: 'full',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.INVOICES_EDIT)
								? { add: '/pages/accounting/invoices/add' }
								: {})
						}
					},
					{
						title: 'Invoices Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/accounting/invoices/recurring',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.RECURRING_INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE_RECURRING
						}
					},
					{
						title: 'Invoices Received',
						icon: 'fas fa-file-invoice-dollar',
						link: '/pages/accounting/invoices/received-invoices',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.INVOICES_RECEIVED',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE_RECEIVED
						}
					},
					{
						title: 'Income',
						icon: 'fas fa-plus-circle',
						link: '/pages/accounting/income',
						data: {
							translationKey: 'MENU.INCOME',
							permissionKeys: [PermissionsEnum.ORG_INCOMES_VIEW],
							featureKey: FeatureEnum.FEATURE_INCOME,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_INCOMES_EDIT
							)
								? { add: '/pages/accounting/income?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Expenses',
						icon: 'fas fa-minus-circle',
						link: '/pages/accounting/expenses',
						data: {
							translationKey: 'MENU.EXPENSES',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_EXPENSE,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							)
								? { add: '/pages/accounting/expenses?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Expense Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/accounting/expense-recurring',
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EXPENSE_RECURRING',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_RECURRING_EXPENSE,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							)
								? { add: '/pages/accounting/expense-recurring?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Payments',
						icon: 'fas fa-cash-register',
						link: '/pages/accounting/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW],
							featureKey: FeatureEnum.FEATURE_PAYMENT,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PAYMENT_ADD_EDIT
							)
								? { add: '/pages/accounting/payments?openAddDialog=true' }
								: {})
						}
					}
				]
			},
			{
				title: 'Sales',
				icon: 'fas fa-chart-line',
				link: '/pages/sales',
				data: {
					translationKey: 'MENU.SALES',
					permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
				},
				children: [
					{
						title: 'Proposals',
						icon: 'fas fa-paper-plane',
						link: '/pages/sales/proposals',
						data: {
							translationKey: 'MENU.PROPOSALS',
							permissionKeys: [
								PermissionsEnum.ORG_PROPOSALS_VIEW
							],
							featureKey: FeatureEnum.FEATURE_PROPOSAL,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROPOSALS_EDIT
							)
								? { add: '/pages/sales/proposals/register' }
								: {})
						}
					},
					{
						title: 'Estimates',
						icon: 'far fa-file',
						link: '/pages/sales/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ESTIMATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_PROPOSAL,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ESTIMATES_EDIT
							)
								? { add: '/pages/sales/invoices/estimates/add' }
								: {})
						}
					},
					{
						title: 'Invoices',
						icon: 'far fa-file-alt',
						link: '/pages/sales/invoices',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.INVOICES_EDIT)
								? { add: '/pages/sales/invoices/add' }
								: {})
						}
					},
					{
						title: 'Invoices Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/sales/invoices/recurring',
						data: {
							translationKey: 'MENU.RECURRING_INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE_RECURRING
						}
					},
					{
						title: 'Payments',
						icon: 'fas fa-cash-register',
						link: '/pages/sales/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW],
							featureKey: FeatureEnum.FEATURE_PAYMENT,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PAYMENT_ADD_EDIT
							)
								? { add: '/pages/sales/payments?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Pipelines',
						icon: 'fas fa-filter',
						link: '/pages/sales/pipelines',
						data: {
							translationKey: 'MENU.PIPELINES',
							permissionKeys: [
								PermissionsEnum.VIEW_SALES_PIPELINES
							],
							featureKey: FeatureEnum.FEATURE_PIPELINE,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.EDIT_SALES_PIPELINES
							)
								? { add: '/pages/sales/pipelines?openAddDialog=true' }
								: {})
						}
					}
				]
			},
			{
				title: 'Tasks',
				icon: 'fas fa-tasks',
				link: '/pages/tasks',
				data: {
					translationKey: 'MENU.TASKS'
				},
				children: [
					{
						title: 'Dashboard',
						icon: 'fas fa-th',
						link: '/pages/tasks/dashboard',
						data: {
							translationKey: 'MENU.DASHBOARD',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ORG_TASK_VIEW
							],
							featureKey: FeatureEnum.FEATURE_DASHBOARD_TASK,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
								? { add: '/pages/tasks/dashboard?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'My Tasks',
						icon: 'fas fa-user',
						link: '/pages/tasks/me',
						data: {
							translationKey: 'MENU.MY_TASKS',
							hide: () => !this.isEmployee,
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ORG_TASK_VIEW
							],
							featureKey: FeatureEnum.FEATURE_MY_TASK,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
								? { add: '/pages/tasks/me?openAddDialog=true' }
								: {})
						}
					},
					{
						title: "Team's Tasks",
						icon: 'fas fa-user-friends',
						link: '/pages/tasks/team',
						data: {
							translationKey: 'MENU.TEAM_TASKS',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ORG_TASK_VIEW
							],
							featureKey: FeatureEnum.FEATURE_TEAM_TASK,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
								? { add: '/pages/tasks/team?openAddDialog=true' }
								: {})
						}
					}
				]
			},
			{
				title: 'Jobs',
				icon: 'fas fa-briefcase',
				link: '/pages/jobs',
				data: {
					translationKey: 'MENU.JOBS',
					featureKey: FeatureEnum.FEATURE_JOB
				},
				children: [
					{
						title: 'Employee',
						icon: 'fas fa-user-friends',
						link: '/pages/jobs/employee',
						data: {
							translationKey: 'MENU.EMPLOYEES',
							permissionKeys: [
								PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW
							]
						}
					},
					/** */
					...(this.isEmployeeJobMatchingEntity ? [
						{
							title: 'Browse',
							icon: 'fas fa-list',
							link: '/pages/jobs/search',
							data: {
								translationKey: 'MENU.JOBS_SEARCH',
								permissionKeys: [
									PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW,
									PermissionsEnum.ORG_JOB_MATCHING_VIEW
								]
							}
						},
						{
							title: 'Matching',
							icon: 'fas fa-user',
							link: '/pages/jobs/matching',
							data: {
								translationKey: 'MENU.JOBS_MATCHING',
								permissionKeys: [
									PermissionsEnum.ORG_JOB_MATCHING_VIEW
								]
							}
						},
					] : []),
					{
						title: 'Proposal Template',
						icon: 'far fa-file-alt',
						link: '/pages/jobs/proposal-template',
						data: {
							translationKey: 'MENU.PROPOSAL_TEMPLATE',
							permissionKeys: [
								PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW
							],
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT
							)
								? { add: '/pages/jobs/proposal-template?openAddDialog=true' }
								: {})
						}
					}
				]
			},
			{
				title: 'Employees',
				icon: 'fas fa-user-friends',
				data: {
					translationKey: 'MENU.EMPLOYEES'
				},
				children: [
					{
						title: 'Manage',
						icon: 'fas fa-list',
						link: '/pages/employees',
						pathMatch: 'full',
						data: {
							translationKey: 'MENU.MANAGE',
							permissionKeys: [
								PermissionsEnum.ORG_EMPLOYEES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEES
						}
					},
					{
						title: 'Time & Activity',
						icon: 'fas fa-chart-line',
						link: '/pages/employees/activity',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIME_ACTIVITY',
							permissionKeys: [
								PermissionsEnum.ADMIN_DASHBOARD_VIEW,
								PermissionsEnum.TIME_TRACKER
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIME_ACTIVITY
						}
					},
					{
						title: 'Timesheets',
						icon: 'far fa-clock',
						link: '/pages/employees/timesheets',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIMESHEETS',
							permissionKeys: [
								PermissionsEnum.ADMIN_DASHBOARD_VIEW,
								PermissionsEnum.TIME_TRACKER
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMESHEETS
						}
					},
					{
						title: 'Appointments',
						icon: 'fas fa-calendar-week',
						link: '/pages/employees/appointments',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.APPOINTMENTS',
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_APPOINTMENT
						}
					},
					{
						title: 'Approvals',
						icon: 'fas fa-repeat',
						link: '/pages/employees/approvals',
						data: {
							translationKey: 'MENU.APPROVALS',
							permissionKeys: [
								PermissionsEnum.REQUEST_APPROVAL_VIEW
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_APPROVAL,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.REQUEST_APPROVAL_EDIT
							)
								? { add: '/pages/employees/approvals?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Employee Levels',
						icon: 'fas fa-chart-bar',
						link: `/pages/employees/employee-level`,
						data: {
							translationKey: 'MENU.EMPLOYEE_LEVEL',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_LEVEL
						}
					},
					{
						title: 'Positions',
						icon: 'fas fa-award',
						link: `/pages/employees/positions`,
						data: {
							translationKey: 'MENU.POSITIONS',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_POSITION
						}
					},
					{
						title: 'Time Off',
						icon: 'far fa-times-circle',
						link: '/pages/employees/time-off',
						data: {
							translationKey: 'MENU.TIME_OFF',
							permissionKeys: [PermissionsEnum.ORG_TIME_OFF_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMEOFF,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TIME_OFF_VIEW
							)
								? { add: '/pages/employees/time-off?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Recurring Expenses',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/employees/recurring-expenses',
						data: {
							translationKey: 'MENU.RECURRING_EXPENSE',
							permissionKeys: [
								PermissionsEnum.EMPLOYEE_EXPENSES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_RECURRING_EXPENSE,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.EMPLOYEE_EXPENSES_EDIT
							)
								? { add: '/pages/employees/recurring-expenses?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Candidates',
						icon: 'fas fa-user-check',
						link: '/pages/employees/candidates',
						data: {
							translationKey: 'MENU.CANDIDATES',
							permissionKeys: [
								PermissionsEnum.ORG_CANDIDATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_CANDIDATE,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CANDIDATES_EDIT
							)
								? { add: '/pages/employees/candidates?openAddDialog=true' }
								: {})
						}
					}
				]
			},
			{
				title: 'Organization',
				icon: 'fas fa-globe-americas',
				data: {
					translationKey: 'MENU.ORGANIZATION',
					withOrganizationShortcuts: true
				},
				children: [
					{
						title: 'Manage',
						icon: 'fas fa-globe-americas',
						pathMatch: 'prefix',
						data: {
							organizationShortcut: true,
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							urlPrefix: `/pages/organizations/edit/`,
							urlPostfix: '',
							translationKey: 'MENU.MANAGE',
							featureKey: FeatureEnum.FEATURE_ORGANIZATION
						}
					},
					{
						title: 'Equipment',
						icon: 'fas fa-border-all',
						link: '/pages/organization/equipment',
						data: {
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ORG_EQUIPMENT_VIEW
							],
							translationKey: 'MENU.EQUIPMENT',
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_EQUIPMENT,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EQUIPMENT_EDIT
							)
								? { add: '/pages/organization/equipment?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Inventory',
						icon: 'fas fa-grip-vertical',
						link: '/pages/organization/inventory',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.INVENTORY',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_INVENTORY,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVENTORY_GALLERY_ADD
							)
								? { add: '/pages/organization/inventory/create' }
								: {})
						}
					},
					{
						title: 'Tags',
						icon: 'fas fa-tag',
						link: '/pages/organization/tags',
						data: {
							translationKey: 'MENU.TAGS',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ORG_TAGS_ADD
							],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_TAG,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD)
								? { add: '/pages/organization/tags?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Vendors',
						icon: 'fas fa-truck',
						link: '/pages/organization/vendors',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.VENDORS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_VENDOR,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
								? { add: '/pages/organization/vendors?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Projects',
						icon: 'fas fa-book',
						link: `/pages/organization/projects`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.PROJECTS',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROJECT_VIEW
							],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_PROJECT,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROJECT_ADD
							)
								? { add: '/pages/organization/projects/create' }
								: {})
						}
					},
					{
						title: 'Departments',
						icon: ' fas fa-briefcase',
						link: `/pages/organization/departments`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DEPARTMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_DEPARTMENT,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
								? { add: '/pages/organization/departments?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Teams',
						icon: 'fas fa-user-friends',
						link: `/pages/organization/teams`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EDIT.TEAMS',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TEAM_VIEW
							],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_TEAM,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
								? { add: '/pages/organization/teams?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Documents',
						icon: 'far fa-file-alt',
						link: `/pages/organization/documents`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DOCUMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_DOCUMENT,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
								? { add: '/pages/organization/documents?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Employment Types',
						icon: 'fas fa-layer-group',
						link: `/pages/organization/employment-types`,
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EMPLOYMENT_TYPES',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE,
							...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
								? { add: '/pages/organization/employment-types?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Expense Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/organization/expense-recurring',
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EXPENSE_RECURRING',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_RECURRING_EXPENSE,
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							)
								? { add: '/pages/organization/expense-recurring?openAddDialog=true' }
								: {})
						}
					},
					{
						title: 'Help Center',
						icon: 'far fa-question-circle',
						link: '/pages/organization/help-center',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.HELP_CENTER',
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_HELP_CENTER
						}
					}
				]
			},
			{
				title: 'Contacts',
				icon: 'far fa-address-book',
				data: {
					translationKey: 'MENU.CONTACTS',
					permissionKeys: [
						PermissionsEnum.ORG_CONTACT_VIEW,
						PermissionsEnum.ALL_ORG_VIEW
					],
					featureKey: FeatureEnum.FEATURE_CONTACT
				},
				children: [
					{
						title: 'Visitors',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/visitors`,
						data: {
							translationKey: 'CONTACTS_PAGE.VISITORS'
						}
					},
					{
						title: 'Leads',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/leads`,
						data: {
							translationKey: 'CONTACTS_PAGE.LEADS',
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							)
								? {
									add: '/pages/contacts/leads?openAddDialog=true'
								}
								: {})
						}
					},
					{
						title: 'Customers',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/customers`,
						data: {
							translationKey: 'CONTACTS_PAGE.CUSTOMERS',
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							)
								? {
									add: '/pages/contacts/customers?openAddDialog=true'
								}
								: {})
						}
					},
					{
						title: 'Clients',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/clients`,
						data: {
							translationKey: 'CONTACTS_PAGE.CLIENTS',
							...(this.store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							)
								? {
									add: '/pages/contacts/clients?openAddDialog=true'
								}
								: {})
						}
					}
				]
			},
			{
				title: 'Goals',
				icon: 'fab fa-font-awesome-flag',
				data: {
					translationKey: 'MENU.GOALS'
				},
				children: [
					{
						title: 'Manage',
						link: '/pages/goals',
						pathMatch: 'full',
						icon: 'fas fa-list',
						data: {
							translationKey: 'MENU.MANAGE',
							featureKey: FeatureEnum.FEATURE_GOAL
						}
					},
					{
						title: 'Report',
						link: '/pages/goals/reports',
						icon: 'far fa-file-alt',
						data: {
							translationKey: 'MENU.REPORTS',
							featureKey: FeatureEnum.FEATURE_GOAL_REPORT
						}
					},
					{
						title: 'Settings',
						link: '/pages/goals/settings',
						icon: 'fas fa-cog',
						data: {
							translationKey: 'MENU.SETTINGS',
							featureKey: FeatureEnum.FEATURE_GOAL_SETTING
						}
					}
				]
			},
			{
				title: 'Reports',
				icon: 'fas fa-chart-pie',
				link: '/pages/reports',
				data: {
					translationKey: 'MENU.REPORTS',
					featureKey: FeatureEnum.FEATURE_REPORT
				},
				children: [
					{
						title: 'All Reports',
						link: '/pages/reports/all',
						icon: 'fas fa-chart-bar',
						data: {
							translationKey: 'MENU.ALL_REPORTS'
						}
					},
					...this.reportMenuItems
				]
			}
		];
	}

	async ngOnInit() {
		this.route.data
			.pipe(
				filter(({ user }: Data) => !!user),
				tap(({ user }: Data) => {
					//When a new user registers & logs in for the first time, he/she does not have tenantId.
					//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
					if (!user.tenantId) {
						this.router.navigate(['/onboarding/tenant']);
						return;
					}
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
		await this._createEntryPoint();
		this._applyTranslationOnSmartTable();

		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => this.isEmployee = !!user.employee),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getReportsMenus()),
				tap(() => this.getIntegrationEntitySettings()),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.userRolePermissions$
			.pipe(
				filter((permissions: IRolePermission[]) =>
					isNotEmpty(permissions)
				),
				map((permissions) =>
					permissions.map(({ permission }) => permission)
				),
				tap((permissions) =>
					this.ngxPermissionsService.loadPermissions(permissions)
				),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts
				);
			});
		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.pipe(untilDestroyed(this))
			.subscribe((e) => {
				this.loadItems(
					this.selectorService.showSelectors(e['url'])
						.showOrganizationShortcuts
				);
			});
		this.reportService.menuItems$
			.pipe(distinctUntilChange(), untilDestroyed(this))
			.subscribe((menuItems) => {
				if (menuItems) {
					this.reportMenuItems = chain(menuItems)
						.values()
						.map((item) => {
							return {
								title: item.name,
								link: `/pages/reports/${item.slug}`,
								icon: item.iconClass,
								data: {
									translationKey: `${item.name}`
								}
							};
						})
						.value();
				} else {
					this.reportMenuItems = [];
				}

				this.menu = this.getMenuItems();
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts
				);
			});
		this.store.featureOrganizations$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts
				);
			});
		this.store.featureTenant$.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadItems(
				this.selectorService.showSelectors(this.router.url)
					.showOrganizationShortcuts
			);
		});
		this.menu = this.getMenuItems();
	}

	ngAfterViewInit(): void {
		this._integrationEntitySettingServiceStoreService.jobMatchingEntity$
			.pipe(
				distinctUntilChange(), // Ensure that only distinct changes are considered
				filter(({ currentValue }: IJobMatchingEntity) => !!currentValue), // Filter out falsy values
				tap(({ currentValue }: IJobMatchingEntity) => {
					// Update component properties based on the current job matching entity settings
					this.isEmployeeJobMatchingEntity = !!currentValue.sync && !!currentValue.isActive;
					this.menu = this.getMenuItems(); // Recreate menu items based on the updated settings
				}),
				// Handling the component lifecycle to avoid memory leaks
				untilDestroyed(this)
			).subscribe();
	}

	/**
	 * Retrieves and processes integration entity settings for the specified organization.
	 * This function fetches integration data, filters, and updates the job matching entity state.
	 * If the organization is not available, the function exits early.
	 */
	getIntegrationEntitySettings(): void {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		// Extract necessary properties from the organization
		const { id: organizationId, tenantId } = this.organization;

		// Fetch integration data from the service based on specified options
		const integration$ = this._integrationsService.getIntegrationByOptions({
			organizationId,
			tenantId,
			name: IntegrationEnum.GAUZY_AI,
			relations: ['entitySettings']
		});

		// Update job matching entity setting using the integration$ observable
		this._integrationEntitySettingServiceStoreService.updateAIJobMatchingEntity(integration$).subscribe();
	}

	async getReportsMenus() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		await this.reportService.getReportMenuItems({
			tenantId,
			organizationId
		});
		this.loadItems(
			this.selectorService.showSelectors(this.router.url)
				.showOrganizationShortcuts
		);
	}

	/*
	 * This is app entry point after login
	 */
	private async _createEntryPoint() {
		const id = this.store.userId;
		if (!id) return;

		this.user = await this.usersService.getMe([
			'role.rolePermissions',
			'tenant',
			'tenant.featureOrganizations',
			'tenant.featureOrganizations.feature'
		], true);

		this.authStrategy.electronAuthentication({
			user: this.user,
			token: this.store.token
		});

		//When a new user registers & logs in for the first time, he/she does not have tenantId.
		//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
		if (!this.user.tenantId) {
			this.router.navigate(['/onboarding/tenant']);
			return;
		}

		this.store.user = this.user;

		//tenant enabled/disabled features for relatives organizations
		const { tenant, role } = this.user;
		this.store.featureTenant = tenant.featureOrganizations.filter(
			(item) => !item.organizationId
		);

		//only enabled permissions assign to logged in user
		this.store.userRolePermissions = role.rolePermissions.filter(
			(permission) => permission.enabled
		);
	}

	loadItems(withOrganizationShortcuts: boolean) {
		this.menu.forEach((item) => {
			this.refreshMenuItem(item, withOrganizationShortcuts);
		});
	}

	refreshMenuItem(item, withOrganizationShortcuts) {
		item.title = this.getTranslation(item.data.translationKey);
		if (item.data.permissionKeys || item.data.hide) {
			const anyPermission = item.data.permissionKeys
				? item.data.permissionKeys.reduce((permission, key) => {
					return this.store.hasPermission(key) || permission;
				}, false)
				: true;

			item.hidden =
				!anyPermission || (item.data.hide && item.data.hide());

			if (anyPermission && item.data.organizationShortcut) {
				item.hidden = !withOrganizationShortcuts || !this.organization;
				if (!item.hidden) {
					item.link =
						item.data.urlPrefix +
						this.organization.id +
						item.data.urlPostfix;
				}
			}
		}

		// enabled/disabled features from here
		if (item.data.hasOwnProperty('featureKey') && item.hidden !== true) {
			const { featureKey } = item.data;
			const enabled = !this.store.hasFeatureEnabled(featureKey);
			item.hidden = enabled || (item.data.hide && item.data.hide());
		}

		if (item.children) {
			item.children.forEach((childItem) => {
				this.refreshMenuItem(childItem, withOrganizationShortcuts);
			});
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadItems(
				this.selectorService.showSelectors(this.router.url)
					.showOrganizationShortcuts
			);
		});
	}

	ngOnDestroy() { }
}

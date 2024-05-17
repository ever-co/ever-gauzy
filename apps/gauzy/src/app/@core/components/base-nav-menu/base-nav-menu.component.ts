import { Directive, OnDestroy, OnInit } from '@angular/core';
import { merge } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FeatureEnum, IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { NavMenuBuilderService, NavMenuSectionItem } from '@gauzy/ui-sdk/core';
import { Store } from '../../services/store.service';
import { SidebarMenuService } from '../../../@shared/sidebar-menu/sidebar-menu.service';

@UntilDestroy()
@Directive({
	selector: '[gaBaseNavMenu]'
})
export class BaseNavMenuComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	constructor(
		protected readonly _navMenuBuilderService: NavMenuBuilderService,
		protected readonly _store: Store,
		protected readonly _sidebarMenuService: SidebarMenuService,
		protected readonly _translate: TranslateService
	) {
		super(_translate);
	}

	ngOnInit(): void {
		this.defineBaseNavMenus();
	}

	ngAfterViewInit() {
		merge(
			this.translateService.onLangChange.pipe(tap(() => this.defineBaseNavMenus())),
			this._store.selectedOrganization$.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap(() => this.defineBaseNavMenus())
			),
			this._store.featureOrganizations$.pipe(tap(() => this.defineBaseNavMenus())),
			this._store.featureTenant$.pipe(tap(() => this.defineBaseNavMenus())),
			this._store.userRolePermissions$.pipe(tap(() => this.defineBaseNavMenus()))
		)
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	/**
	 * Defines the base navigation menus.
	 */
	private defineBaseNavMenus() {
		this._navMenuBuilderService.defineNavMenuSections([
			{
				id: 'dashboards',
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
				id: 'focus',
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
				id: 'applications',
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
				id: 'accounting',
				title: 'Accounting',
				icon: 'far fa-address-card',
				data: {
					translationKey: 'MENU.ACCOUNTING'
				},
				items: [
					{
						id: 'accounting-estimates',
						title: 'Estimates',
						icon: 'far fa-file',
						link: '/pages/accounting/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
							featureKey: FeatureEnum.FEATURE_ESTIMATE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ESTIMATES_EDIT
							) && {
								add: '/pages/accounting/invoices/estimates/add'
							})
						}
					},
					{
						id: 'accounting-estimates-received',
						title: 'Estimates Received',
						icon: 'fas fa-file-invoice',
						link: '/pages/accounting/invoices/received-estimates',
						data: {
							translationKey: 'MENU.ESTIMATES_RECEIVED',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
							featureKey: FeatureEnum.FEATURE_ESTIMATE_RECEIVED
						}
					},
					{
						id: 'accounting-invoices',
						title: 'Invoices',
						icon: 'far fa-file-alt',
						link: '/pages/accounting/invoices',
						pathMatch: 'full',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
							featureKey: FeatureEnum.FEATURE_INVOICE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVOICES_EDIT
							) && {
								add: '/pages/accounting/invoices/add'
							})
						}
					},
					{
						id: 'accounting-invoices-recurring',
						title: 'Invoices Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/accounting/invoices/recurring',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.RECURRING_INVOICES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
							featureKey: FeatureEnum.FEATURE_INVOICE_RECURRING
						}
					},
					{
						id: 'accounting-invoices-received',
						title: 'Invoices Received',
						icon: 'fas fa-file-invoice-dollar',
						link: '/pages/accounting/invoices/received-invoices',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.INVOICES_RECEIVED',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
							featureKey: FeatureEnum.FEATURE_INVOICE_RECEIVED
						}
					},
					{
						id: 'accounting-income',
						title: 'Income',
						icon: 'fas fa-plus-circle',
						link: '/pages/accounting/income',
						data: {
							translationKey: 'MENU.INCOME',
							permissionKeys: [PermissionsEnum.ORG_INCOMES_VIEW],
							featureKey: FeatureEnum.FEATURE_INCOME,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_INCOMES_EDIT
							) && {
								add: '/pages/accounting/income?openAddDialog=true'
							})
						}
					},
					{
						id: 'accounting-expenses',
						title: 'Expenses',
						icon: 'fas fa-minus-circle',
						link: '/pages/accounting/expenses',
						data: {
							translationKey: 'MENU.EXPENSES',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_EXPENSE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							) && {
								add: '/pages/accounting/expenses?openAddDialog=true'
							})
						}
					},
					{
						id: 'accounting-expense-recurring',
						title: 'Expense Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/accounting/expense-recurring',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EXPENSE_RECURRING',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_RECURRING_EXPENSE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							) && {
								add: '/pages/accounting/expense-recurring?openAddDialog=true'
							})
						}
					},
					{
						id: 'accounting-payments',
						title: 'Payments',
						icon: 'fas fa-cash-register',
						link: '/pages/accounting/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW],
							featureKey: FeatureEnum.FEATURE_PAYMENT,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PAYMENT_ADD_EDIT
							) && {
								add: '/pages/accounting/payments?openAddDialog=true'
							})
						}
					}
				]
			},
			{
				id: 'sales',
				title: 'Sales',
				icon: 'fas fa-chart-line',
				link: '/pages/sales',
				data: {
					translationKey: 'MENU.SALES',
					permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
				},
				items: [
					{
						id: 'sales-proposals',
						title: 'Proposals',
						icon: 'fas fa-paper-plane',
						link: '/pages/sales/proposals',
						data: {
							translationKey: 'MENU.PROPOSALS',
							permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW],
							featureKey: FeatureEnum.FEATURE_PROPOSAL,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROPOSALS_EDIT
							) && {
								add: '/pages/sales/proposals/register'
							})
						}
					},
					{
						id: 'sales-estimates',
						title: 'Estimates',
						icon: 'far fa-file',
						link: '/pages/sales/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
							featureKey: FeatureEnum.FEATURE_PROPOSAL,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ESTIMATES_EDIT
							) && {
								add: '/pages/sales/invoices/estimates/add'
							})
						}
					},
					{
						id: 'sales-invoices',
						title: 'Invoices',
						icon: 'far fa-file-alt',
						link: '/pages/sales/invoices',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
							featureKey: FeatureEnum.FEATURE_INVOICE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVOICES_EDIT
							) && {
								add: '/pages/sales/invoices/add'
							})
						}
					},
					{
						id: 'sales-invoices-recurring',
						title: 'Invoices Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/sales/invoices/recurring',
						data: {
							translationKey: 'MENU.RECURRING_INVOICES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW],
							featureKey: FeatureEnum.FEATURE_INVOICE_RECURRING
						}
					},
					{
						id: 'sales-payments',
						title: 'Payments',
						icon: 'fas fa-cash-register',
						link: '/pages/sales/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW],
							featureKey: FeatureEnum.FEATURE_PAYMENT,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PAYMENT_ADD_EDIT
							) && {
								add: '/pages/sales/payments?openAddDialog=true'
							})
						}
					},
					{
						id: 'sales-pipelines',
						title: 'Pipelines',
						icon: 'fas fa-filter',
						link: '/pages/sales/pipelines',
						data: {
							translationKey: 'MENU.PIPELINES',
							permissionKeys: [PermissionsEnum.VIEW_SALES_PIPELINES],
							featureKey: FeatureEnum.FEATURE_PIPELINE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.EDIT_SALES_PIPELINES
							) && {
								add: '/pages/sales/pipelines?openAddDialog=true'
							})
						}
					}
				]
			},
			{
				id: 'tasks',
				title: 'Tasks',
				icon: 'fas fa-tasks',
				link: '/pages/tasks',
				data: {
					translationKey: 'MENU.TASKS'
				},
				items: [
					{
						id: 'tasks-dashboard',
						title: 'Dashboard',
						icon: 'fas fa-th',
						link: '/pages/tasks/dashboard',
						data: {
							translationKey: 'MENU.DASHBOARD',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW],
							featureKey: FeatureEnum.FEATURE_DASHBOARD_TASK,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TASK_ADD
							) && {
								add: '/pages/tasks/dashboard?openAddDialog=true'
							})
						}
					},
					{
						id: 'tasks-team',
						title: "Team's Tasks",
						icon: 'fas fa-user-friends',
						link: '/pages/tasks/team',
						data: {
							translationKey: 'MENU.TEAM_TASKS',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW],
							featureKey: FeatureEnum.FEATURE_TEAM_TASK,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TASK_ADD
							) && {
								add: '/pages/tasks/team?openAddDialog=true'
							})
						}
					}
				]
			},
			{
				id: 'jobs',
				title: 'Jobs',
				icon: 'fas fa-briefcase',
				link: '/pages/jobs',
				data: {
					translationKey: 'MENU.JOBS',
					featureKey: FeatureEnum.FEATURE_JOB
				},
				items: [
					{
						id: 'jobs-employee',
						title: 'Employee',
						icon: 'fas fa-user-friends',
						link: '/pages/jobs/employee',
						data: {
							translationKey: 'MENU.EMPLOYEES',
							permissionKeys: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW]
						}
					},
					{
						id: 'jobs-proposal-template',
						title: 'Proposal Template',
						icon: 'far fa-file-alt',
						link: '/pages/jobs/proposal-template',
						data: {
							translationKey: 'MENU.PROPOSAL_TEMPLATE',
							permissionKeys: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT
							) && {
								add: '/pages/jobs/proposal-template?openAddDialog=true'
							})
						}
					}
				]
			},
			{
				id: 'employees',
				title: 'Employees',
				icon: 'fas fa-user-friends',
				data: {
					translationKey: 'MENU.EMPLOYEES'
				},
				items: [
					{
						id: 'employees-manage',
						title: 'Manage',
						icon: 'fas fa-list',
						link: '/pages/employees',
						pathMatch: 'full',
						data: {
							translationKey: 'MENU.MANAGE',
							permissionKeys: [PermissionsEnum.ORG_EMPLOYEES_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEES
						}
					},
					{
						id: 'employees-time-activity',
						title: 'Time & Activity',
						icon: 'fas fa-chart-line',
						link: '/pages/employees/activity',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIME_ACTIVITY',
							permissionKeys: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKER],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIME_ACTIVITY
						}
					},
					{
						id: 'employees-timesheets',
						title: 'Timesheets',
						icon: 'far fa-clock',
						link: '/pages/employees/timesheets',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIMESHEETS',
							permissionKeys: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKER],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMESHEETS
						}
					},
					{
						id: 'employees-appointments',
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
						id: 'employees-approvals',
						title: 'Approvals',
						icon: 'fas fa-repeat',
						link: '/pages/employees/approvals',
						data: {
							translationKey: 'MENU.APPROVALS',
							permissionKeys: [PermissionsEnum.REQUEST_APPROVAL_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_APPROVAL,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.REQUEST_APPROVAL_EDIT
							) && {
								add: '/pages/employees/approvals?openAddDialog=true'
							})
						}
					},
					{
						id: 'employees-levels',
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
						id: 'employees-positions',
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
						id: 'employees-time-off',
						title: 'Time Off',
						icon: 'far fa-times-circle',
						link: '/pages/employees/time-off',
						data: {
							translationKey: 'MENU.TIME_OFF',
							permissionKeys: [PermissionsEnum.ORG_TIME_OFF_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMEOFF,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TIME_OFF_VIEW
							) && {
								add: '/pages/employees/time-off?openAddDialog=true'
							})
						}
					},
					{
						id: 'employees-recurring-expenses',
						title: 'Recurring Expenses',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/employees/recurring-expenses',
						data: {
							translationKey: 'MENU.RECURRING_EXPENSE',
							permissionKeys: [PermissionsEnum.EMPLOYEE_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_RECURRING_EXPENSE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.EMPLOYEE_EXPENSES_EDIT
							) && {
								add: '/pages/employees/recurring-expenses?openAddDialog=true'
							})
						}
					},
					{
						id: 'employees-candidates',
						title: 'Candidates',
						icon: 'fas fa-user-check',
						link: '/pages/employees/candidates',
						data: {
							translationKey: 'MENU.CANDIDATES',
							permissionKeys: [PermissionsEnum.ORG_CANDIDATES_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_CANDIDATE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CANDIDATES_EDIT
							) && {
								add: '/pages/employees/candidates?openAddDialog=true'
							})
						}
					}
				]
			},
			{
				id: 'organization',
				title: 'Organization',
				icon: 'fas fa-globe-americas',
				data: {
					translationKey: 'MENU.ORGANIZATION'
				},
				items: [
					{
						id: 'organization-equipment',
						title: 'Equipment',
						icon: 'fas fa-border-all',
						link: '/pages/organization/equipment',
						data: {
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EQUIPMENT_VIEW],
							translationKey: 'MENU.EQUIPMENT',
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_EQUIPMENT,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EQUIPMENT_EDIT
							) && {
								add: '/pages/organization/equipment?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-inventory',
						title: 'Inventory',
						icon: 'fas fa-grip-vertical',
						link: '/pages/organization/inventory',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.INVENTORY',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_INVENTORY,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVENTORY_GALLERY_ADD
							) && {
								add: '/pages/organization/inventory/create'
							})
						}
					},
					{
						id: 'organization-tags',
						title: 'Tags',
						icon: 'fas fa-tag',
						link: '/pages/organization/tags',
						data: {
							translationKey: 'MENU.TAGS',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAGS_ADD],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_TAG,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TAGS_ADD
							) && {
								add: '/pages/organization/tags?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-vendors',
						title: 'Vendors',
						icon: 'fas fa-truck',
						link: '/pages/organization/vendors',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.VENDORS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_VENDOR,
							...(this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT) && {
								add: '/pages/organization/vendors?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-projects',
						title: 'Projects',
						icon: 'fas fa-book',
						link: `/pages/organization/projects`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.PROJECTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_PROJECT,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROJECT_ADD
							) && {
								add: '/pages/organization/projects/create'
							})
						}
					},
					{
						id: 'organization-departments',
						title: 'Departments',
						icon: ' fas fa-briefcase',
						link: `/pages/organization/departments`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DEPARTMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_DEPARTMENT,
							...(this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT) && {
								add: '/pages/organization/departments?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-teams',
						title: 'Teams',
						icon: 'fas fa-user-friends',
						link: `/pages/organization/teams`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EDIT.TEAMS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_TEAM,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TEAM_EDIT
							) && {
								add: '/pages/organization/teams?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-documents',
						title: 'Documents',
						icon: 'far fa-file-alt',
						link: `/pages/organization/documents`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DOCUMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_DOCUMENT,
							...(this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT) && {
								add: '/pages/organization/documents?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-employment',
						title: 'Employment Types',
						icon: 'fas fa-layer-group',
						link: `/pages/organization/employment-types`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EMPLOYMENT_TYPES',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE,
							...(this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT) && {
								add: '/pages/organization/employment-types?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-expense',
						title: 'Expense Recurring',
						icon: 'fas fa-exchange-alt fa-rotate-90',
						link: '/pages/organization/expense-recurring',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EXPENSE_RECURRING',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_RECURRING_EXPENSE,
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							) && {
								add: '/pages/organization/expense-recurring?openAddDialog=true'
							})
						}
					},
					{
						id: 'organization-help',
						title: 'Help Center',
						icon: 'far fa-question-circle',
						link: '/pages/organization/help-center',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.HELP_CENTER',
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_HELP_CENTER
						}
					}
				]
			},
			{
				id: 'contacts',
				title: 'Contacts',
				icon: 'far fa-address-book',
				data: {
					translationKey: 'MENU.CONTACTS',
					permissionKeys: [PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ALL_ORG_VIEW],
					featureKey: FeatureEnum.FEATURE_CONTACT
				},
				items: [
					{
						id: 'contacts-visitors',
						title: 'Visitors',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/visitors`,
						data: {
							translationKey: 'CONTACTS_PAGE.VISITORS'
						}
					},
					{
						id: 'contacts-leads',
						title: 'Leads',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/leads`,
						data: {
							translationKey: 'CONTACTS_PAGE.LEADS',
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							) && {
								add: '/pages/contacts/leads?openAddDialog=true'
							})
						}
					},
					{
						id: 'contacts-customers',
						title: 'Customers',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/customers`,
						data: {
							translationKey: 'CONTACTS_PAGE.CUSTOMERS',
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							) && {
								add: '/pages/contacts/customers?openAddDialog=true'
							})
						}
					},
					{
						id: 'contacts-clients',
						title: 'Clients',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/clients`,
						data: {
							translationKey: 'CONTACTS_PAGE.CLIENTS',
							...(this._store.hasAnyPermission(
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							) && {
								add: '/pages/contacts/clients?openAddDialog=true'
							})
						}
					}
				]
			},
			{
				id: 'goals',
				title: 'Goals',
				icon: 'fab fa-font-awesome-flag',
				data: {
					translationKey: 'MENU.GOALS'
				},
				items: [
					{
						id: 'goals-manage',
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
						id: 'goals-report',
						title: 'Report',
						link: '/pages/goals/reports',
						icon: 'far fa-file-alt',
						data: {
							translationKey: 'MENU.REPORTS',
							featureKey: FeatureEnum.FEATURE_GOAL_REPORT
						}
					},
					{
						id: 'goals-settings',
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
				id: 'reports',
				title: 'Reports',
				icon: 'fas fa-chart-pie',
				link: '/pages/reports',
				data: {
					translationKey: 'MENU.REPORTS',
					featureKey: FeatureEnum.FEATURE_REPORT
				},
				items: [
					{
						id: 'reports-all',
						title: 'All Reports',
						link: '/pages/reports/all',
						icon: 'fas fa-chart-bar',
						data: {
							translationKey: 'MENU.ALL_REPORTS'
						}
					}
				]
			}
		]);
	}

	/**
	 * Maps menu sections and their sub-sections recursively.
	 *
	 * @param items The menu items to map.
	 * @returns The mapped menu sections.
	 */
	public mapMenuSections(items: NavMenuSectionItem[]): NavMenuSectionItem[] {
		return items.map((item: NavMenuSectionItem) => this.mapMenuSection(item));
	}

	/**
	 * Maps a single menu section and its sub-sections recursively.
	 *
	 * @param section The menu section to map.
	 * @returns The mapped menu section.
	 */
	public mapMenuSection(item: NavMenuSectionItem): NavMenuSectionItem {
		const section: NavMenuSectionItem = {
			...item,
			title: this.getTranslation(item.data.translationKey),
			hidden: item.hidden || this.isSectionHidden(item)
		};

		if (item.items) {
			section.children = this.mapMenuSections(item.items);
		}

		return section;
	}

	/**
	 * Checks if a menu section should be hidden based on permissions and features.
	 *
	 * @param section The menu section to check.
	 * @returns True if the section should be hidden, false otherwise.
	 */
	public isSectionHidden(section: NavMenuSectionItem): boolean {
		const { data } = section;
		let isHidden = false;

		// Check if section should be hidden based on permissions or custom hide function
		if (data.permissionKeys || data.hide) {
			// If permission keys are provided, check if any permission is granted
			const anyPermission = data.permissionKeys ? this._store.hasAnyPermission(...data.permissionKeys) : true;

			// If any permission is not granted or custom hide function returns true, hide the section
			if (!anyPermission || (data.hide && data.hide())) {
				isHidden = true;
			}
		}

		// If feature key is provided, check if the feature is enabled
		if (data.featureKey && isHidden === false) {
			isHidden = !this._store.hasFeatureEnabled(data.featureKey);
		}

		// If none of the above conditions are met, the section should not be hidden
		return isHidden;
	}

	ngOnDestroy(): void {}
}

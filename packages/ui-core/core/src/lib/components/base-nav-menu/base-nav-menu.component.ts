import { AfterViewInit, Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, EMPTY } from 'rxjs';
import { catchError, debounceTime, filter, startWith, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FeatureEnum, IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	FavoriteStoreService,
	NavMenuBuilderService,
	NavMenuSectionItem,
	SidebarMenuService,
	Store
} from '../../services';

@UntilDestroy()
@Directive({
	selector: '[gaBaseNavMenu]',
	standalone: true
})
export class BaseNavMenuComponent extends TranslationBaseComponent implements OnInit, AfterViewInit, OnDestroy {
	protected readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	protected readonly _store = inject(Store);
	protected readonly _sidebarMenuService = inject(SidebarMenuService);
	protected readonly _favoriteStoreService = inject(FavoriteStoreService);

	private _favoriteItems: NavMenuSectionItem[] = [];

	constructor(protected readonly _translateService: TranslateService) {
		super(_translateService);
	}

	ngOnInit(): void {
		this.defineBaseNavMenus();
	}

	ngAfterViewInit(): void {
		combineLatest([
			this._favoriteStoreService.favoriteItems$,
			this._translateService.onLangChange.pipe(startWith(null)),
			this._store.selectedOrganization$.pipe(
				filter((organization: IOrganization | null): organization is IOrganization => !!organization),
				distinctUntilChange()
			),
			this._store.featureOrganizations$,
			this._store.featureTenant$,
			this._store.userRolePermissions$
		])
			.pipe(
				debounceTime(50),
				tap(([favorites]) => {
					this._favoriteItems = favorites;
					this.defineBaseNavMenus();
				}),
				catchError((error) => {
					console.error('Error updating navigation menu:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Returns an `{ add: link }` object if the user has any of the given permissions, or undefined otherwise.
	 */
	private _addLink(link: string, ...permissions: PermissionsEnum[]): { add: string } | undefined {
		return this._store.hasAnyPermission(...permissions) ? { add: link } : undefined;
	}

	/**
	 * Defines the base navigation menus.
	 */
	private defineBaseNavMenus() {
		this._navMenuBuilderService.defineNavMenuSections([
			...this._getMainMenu(),
			...this._getWorkspaceMenu(),
			...this._getSettingsMenu()
		]);
	}

	/**
	 * Retrieves the main navigation menu configuration by composing all section menus.
	 * @returns An array of NavMenuSectionItem objects representing the main menu.
	 */
	private _getMainMenu(): NavMenuSectionItem[] {
		return [
			...this._getDashboardMenu(),
			...this._getFavoritesMenu(),
			...this._getAccountingMenu(),
			...this._getSalesMenu(),
			...this._getTasksMenu(),
			...this._getEmployeesMenu(),
			...this._getOrganizationMenu(),
			...this._getContactsMenu(),
			...this._getGoalsMenu(),
			...this._getReportsMenu()
		];
	}

	/**
	 * Returns the dashboard-related menu items (Dashboards, Focus, Applications).
	 */
	private _getDashboardMenu(): NavMenuSectionItem[] {
		return [
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
			}
		];
	}

	/**
	 * Returns the favorites menu section.
	 */
	private _getFavoritesMenu(): NavMenuSectionItem[] {
		return [
			{
				id: 'favorites',
				title: 'Favorites',
				icon: 'far fa-star',
				hidden: this._favoriteItems.length === 0,
				data: {
					translationKey: 'MENU.FAVORITES'
				},
				items: this._favoriteItems
			}
		];
	}

	/**
	 * Returns the accounting menu section with sub-items.
	 */
	private _getAccountingMenu(): NavMenuSectionItem[] {
		return [
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
							...this._addLink(
								'/pages/accounting/invoices/estimates/add',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ESTIMATES_EDIT
							)
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
							...this._addLink(
								'/pages/accounting/invoices/add',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVOICES_EDIT
							)
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
							...this._addLink(
								'/pages/accounting/income?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_INCOMES_EDIT
							)
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
							...this._addLink(
								'/pages/accounting/expenses?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							)
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
							...this._addLink(
								'/pages/accounting/expense-recurring?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							)
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
							...this._addLink(
								'/pages/accounting/payments?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PAYMENT_ADD_EDIT
							)
						}
					}
				]
			}
		];
	}

	/**
	 * Returns the sales menu section with sub-items.
	 */
	private _getSalesMenu(): NavMenuSectionItem[] {
		return [
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
						id: 'sales-estimates',
						title: 'Estimates',
						icon: 'far fa-file',
						link: '/pages/sales/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW],
							featureKey: FeatureEnum.FEATURE_PROPOSAL,
							...this._addLink(
								'/pages/sales/invoices/estimates/add',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ESTIMATES_EDIT
							)
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
							...this._addLink(
								'/pages/sales/invoices/add',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVOICES_EDIT
							)
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
							...this._addLink(
								'/pages/sales/payments?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PAYMENT_ADD_EDIT
							)
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
							...this._addLink(
								'/pages/sales/pipelines?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.EDIT_SALES_PIPELINES
							)
						}
					}
				]
			}
		];
	}

	/**
	 * Returns the tasks menu section with sub-items.
	 */
	private _getTasksMenu(): NavMenuSectionItem[] {
		return [
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
							...this._addLink(
								'/pages/tasks/dashboard?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TASK_ADD
							)
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
							...this._addLink(
								'/pages/tasks/team?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TASK_ADD
							)
						}
					}
				]
			}
		];
	}

	/**
	 * Returns the employees menu section with sub-items.
	 */
	private _getEmployeesMenu(): NavMenuSectionItem[] {
		return [
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
							...this._addLink(
								'/pages/employees/approvals?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.REQUEST_APPROVAL_EDIT
							)
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
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMEOFF,
							...this._addLink(
								'/pages/employees/time-off?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.TIME_OFF_ADD
							)
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
							...this._addLink(
								'/pages/employees/recurring-expenses?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.EMPLOYEE_EXPENSES_EDIT
							)
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
							...this._addLink(
								'/pages/employees/candidates?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CANDIDATES_EDIT
							)
						}
					}
				]
			}
		];
	}

	/**
	 * Returns the organization menu section with sub-items.
	 */
	private _getOrganizationMenu(): NavMenuSectionItem[] {
		return [
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
							...this._addLink(
								'/pages/organization/equipment?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EQUIPMENT_EDIT
							)
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
							...this._addLink(
								'/pages/organization/inventory/create',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.INVENTORY_GALLERY_ADD
							)
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
							...this._addLink(
								'/pages/organization/tags?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TAGS_ADD
							)
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
							...this._addLink(
								'/pages/organization/vendors?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT
							)
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
							...this._addLink(
								'/pages/organization/projects/create',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_PROJECT_ADD
							)
						}
					},
					{
						id: 'organization-departments',
						title: 'Departments',
						icon: 'fas fa-briefcase',
						link: `/pages/organization/departments`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DEPARTMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_DEPARTMENT,
							...this._addLink(
								'/pages/organization/departments?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT
							)
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
							...this._addLink(
								'/pages/organization/teams?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_TEAM_EDIT
							)
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
							...this._addLink(
								'/pages/organization/documents?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT
							)
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
							...this._addLink(
								'/pages/organization/employment-types?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT
							)
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
							...this._addLink(
								'/pages/organization/expense-recurring?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_EXPENSES_EDIT
							)
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
			}
		];
	}

	/**
	 * Returns the contacts menu section with sub-items.
	 */
	private _getContactsMenu(): NavMenuSectionItem[] {
		return [
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
							...this._addLink(
								'/pages/contacts/leads?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							)
						}
					},
					{
						id: 'contacts-customers',
						title: 'Customers',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/customers`,
						data: {
							translationKey: 'CONTACTS_PAGE.CUSTOMERS',
							...this._addLink(
								'/pages/contacts/customers?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							)
						}
					},
					{
						id: 'contacts-clients',
						title: 'Clients',
						icon: 'fas fa-id-badge',
						link: `/pages/contacts/clients`,
						data: {
							translationKey: 'CONTACTS_PAGE.CLIENTS',
							...this._addLink(
								'/pages/contacts/clients?openAddDialog=true',
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ORG_CONTACT_EDIT
							)
						}
					}
				]
			}
		];
	}

	/**
	 * Returns the goals menu section with sub-items.
	 */
	private _getGoalsMenu(): NavMenuSectionItem[] {
		return [
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
			}
		];
	}

	/**
	 * Returns the reports menu section with sub-items.
	 */
	private _getReportsMenu(): NavMenuSectionItem[] {
		return [
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
		];
	}

	/**
	 * Retrieves the workspace menu configuration based on user permissions.
	 * Each menu item includes an ID, title, icon, link, and additional data such as translation keys,
	 * permission keys, and feature keys.
	 *
	 * @returns An array of NavMenuSectionItem objects representing the workspace menu.
	 */
	private _getWorkspaceMenu(): NavMenuSectionItem[] {
		return [
			{
				id: 'invite-people',
				title: 'Invite people',
				icon: 'fas fa-user-plus',
				link: '/pages/employees/invites',
				menuCategory: 'workspace',
				data: {
					translationKey: 'MENU.INVITE_PEOPLE',
					permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_INVITE_VIEW],
					featureKey: FeatureEnum.FEATURE_MANAGE_INVITE
				}
			},
			{
				id: 'users',
				title: 'Users',
				icon: 'fas fa-users',
				link: '/pages/users',
				menuCategory: 'workspace',
				data: {
					translationKey: 'MENU.USERS',
					permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_USERS_VIEW],
					featureKey: FeatureEnum.FEATURE_USER
				}
			},
			{
				id: 'import-export',
				title: 'Import/Export',
				icon: 'fas fa-exchange-alt',
				link: '/pages/settings/import-export',
				menuCategory: 'workspace',
				data: {
					translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT',
					permissionKeys: [
						PermissionsEnum.ALL_ORG_VIEW,
						PermissionsEnum.IMPORT_ADD,
						PermissionsEnum.EXPORT_ADD
					],
					featureKey: FeatureEnum.FEATURE_IMPORT_EXPORT
				}
			},
			{
				id: 'organizations',
				title: 'Organizations',
				icon: 'fas fa-globe',
				link: '/pages/organizations',
				menuCategory: 'workspace',
				data: {
					translationKey: 'MENU.ORGANIZATIONS',
					permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EXPENSES_EDIT],
					featureKey: FeatureEnum.FEATURE_ORGANIZATIONS
				}
			},
			{
				id: 'integrations',
				title: 'Integrations',
				icon: 'fas fa-swatchbook',
				link: '/pages/integrations',
				menuCategory: 'workspace',
				pathMatch: 'prefix',
				data: {
					translationKey: 'MENU.INTEGRATIONS',
					permissionKeys: [PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT],
					featureKey: FeatureEnum.FEATURE_APP_INTEGRATION
				}
			}
		];
	}

	/**
	 * Retrieves the settings menu configuration.
	 *
	 * @returns An array containing a single NavMenuSectionItem for settings.
	 */
	private _getSettingsMenu(): NavMenuSectionItem[] {
		return [
			{
				id: 'settings',
				title: 'Settings',
				icon: 'fas fa-cog',
				menuCategory: 'settings',
				data: {
					translationKey: 'MENU.SETTINGS'
				},
				items: [
					{
						id: 'settings-general',
						title: 'General',
						icon: 'fas fa-pen',
						link: '/pages/settings/general',
						data: {
							translationKey: 'MENU.GENERAL',
							featureKey: FeatureEnum.FEATURE_SETTING
						}
					},
					{
						id: 'settings-features',
						title: 'Features',
						icon: 'fas fa-swatchbook',
						link: '/pages/settings/features',
						data: {
							translationKey: 'MENU.FEATURES',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW]
						}
					},
					{
						id: 'settings-email-history',
						title: 'Email History',
						icon: 'fas fa-envelope-open',
						link: '/pages/settings/email-history',
						data: {
							translationKey: 'MENU.EMAIL_HISTORY',
							permissionKeys: [PermissionsEnum.VIEW_ALL_EMAILS],
							featureKey: FeatureEnum.FEATURE_EMAIL_HISTORY
						}
					},
					{
						id: 'settings-email-templates',
						title: 'Email Templates',
						icon: 'fas fa-envelope',
						link: '/pages/settings/email-templates',
						data: {
							translationKey: 'MENU.EMAIL_TEMPLATES',
							permissionKeys: [PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES],
							featureKey: FeatureEnum.FEATURE_EMAIL_TEMPLATE
						}
					},
					{
						id: 'settings-accounting-templates',
						title: 'Accounting Templates',
						icon: 'fas fa-address-card',
						link: '/pages/settings/accounting-templates',
						data: {
							translationKey: 'MENU.ACCOUNTING_TEMPLATES',
							permissionKeys: [PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES]
						}
					},
					{
						id: 'settings-file-storage',
						title: 'File storage',
						icon: 'fas fa-database',
						link: '/pages/settings/file-storage',
						data: {
							translationKey: 'MENU.FILE_STORAGE',
							permissionKeys: [PermissionsEnum.FILE_STORAGE_VIEW],
							featureKey: FeatureEnum.FEATURE_FILE_STORAGE
						}
					},
					{
						id: 'settings-monitoring',
						title: 'Monitoring',
						icon: 'fas fa-chart-line',
						link: '/pages/settings/monitoring',
						data: {
							translationKey: 'MENU.MONITORING',
							permissionKeys: [PermissionsEnum.TENANT_SETTING]
						}
					},
					{
						id: 'settings-sms-gateways',
						title: 'SMS Gateways',
						icon: 'fas fa-at',
						link: '/pages/settings/sms-gateway',
						data: {
							translationKey: 'MENU.SMS_GATEWAYS',
							permissionKeys: [PermissionsEnum.SMS_GATEWAY_VIEW],
							featureKey: FeatureEnum.FEATURE_SMS_GATEWAY
						}
					},
					{
						id: 'settings-custom-smtp',
						title: 'Custom SMTP',
						icon: 'fas fa-at',
						link: '/pages/settings/custom-smtp',
						data: {
							translationKey: 'MENU.CUSTOM_SMTP',
							permissionKeys: [PermissionsEnum.CUSTOM_SMTP_VIEW],
							featureKey: FeatureEnum.FEATURE_SMTP
						}
					},
					{
						id: 'settings-roles-permissions',
						title: 'Roles & Permissions',
						link: '/pages/settings/roles-permissions',
						icon: 'fas fa-award',
						data: {
							translationKey: 'MENU.ROLES',
							permissionKeys: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS],
							featureKey: FeatureEnum.FEATURE_ROLES_PERMISSION
						}
					},
					{
						id: 'settings-danger-zone',
						title: 'Danger Zone',
						link: '/pages/settings/danger-zone',
						icon: 'fas fa-radiation-alt',
						data: {
							translationKey: 'MENU.DANGER_ZONE',
							permissionKeys: [
								PermissionsEnum.ACCESS_DELETE_ACCOUNT,
								PermissionsEnum.ACCESS_DELETE_ALL_DATA
							]
						}
					}
				]
			}
		];
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

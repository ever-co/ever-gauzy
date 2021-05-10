import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import {
	FeatureEnum,
	IOrganization,
	IUser,
	PermissionsEnum
} from '@gauzy/contracts';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, map, mergeMap } from 'rxjs/operators';
import { Store } from '../@core/services/store.service';
import { SelectorService } from '../@core/utils/selector.service';
import { EmployeesService, UsersService } from '../@core/services';
import {
	DEFAULT_SELECTOR_VISIBILITY,
	ISelectorVisibility,
	SelectorBuilderService
} from '../@core/services/selector-builder';
import { NgxPermissionsService } from 'ngx-permissions';
import { ReportService } from './reports/all-report/report.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { chain } from 'underscore';
import { AuthStrategy } from '../@core/auth/auth-strategy.service';
import { TranslationBaseComponent } from '../@shared/language-base/translation-base.component';

interface GaMenuItem extends NbMenuItem {
	data: {
		translationKey: string; //Translation key for the title, mandatory for all items
		permissionKeys?: PermissionsEnum[]; //Check permissions and hide item if any given permission is not present
		featureKey?: FeatureEnum; //Check permissions and hide item if any given permission is not present
		withOrganizationShortcuts?: boolean; //Declare if the sidebar item has organization level shortcuts
		hide?: () => boolean; //Hide the menu item if this returns true
	};
}
@UntilDestroy()
@Component({
	selector: 'ngx-pages',
	styleUrls: ['pages.component.scss'],
	template: `
		<ngx-one-column-layout *ngIf="!!menu && user">
			<nb-menu [items]="menu"></nb-menu>
			<router-outlet></router-outlet>
		</ngx-one-column-layout>
	`
})
export class PagesComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	basicMenu: GaMenuItem[];
	adminMenu: GaMenuItem[];
	isAdmin: boolean;
	isEmployee: boolean;
	_selectedOrganization: IOrganization;
	user: IUser;
	menu: NbMenuItem[] = [];
	reportMenuItems: NbMenuItem[];
	headerSelectors: ISelectorVisibility;

	constructor(
		private employeeService: EmployeesService,
		public translate: TranslateService,
		private store: Store,
		private reportService: ReportService,
		private selectorService: SelectorService,
		private router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private ngxPermissionsService: NgxPermissionsService,
		private readonly usersService: UsersService,
		private readonly authStrategy: AuthStrategy,
		public readonly selectorBuilderService: SelectorBuilderService
	) {
		super(translate);
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				map(() => this._activatedRoute),
				map((route) => {
					while (route.firstChild) route = route.firstChild;
					return route;
				}),
				filter((route) => route.outlet === 'primary'),
				mergeMap((route) => route.data)
			)
			.subscribe(({ selectors }: any) => {
				this.headerSelectors = Object.assign(
					{},
					DEFAULT_SELECTOR_VISIBILITY,
					selectors
				);
				Object.entries(this.headerSelectors).forEach(([id, value]) => {
					selectorBuilderService.setSelectorsVisibility(id, value);
				});
				selectorBuilderService.getSelectorsVisibility();
			});
	}

	getMenuItems(): GaMenuItem[] {
		return [
			{
				title: 'Dashboard',
				icon: 'home-outline',
				link: '/pages/dashboard',
				pathMatch: 'prefix',
				home: true,
				data: {
					translationKey: 'MENU.DASHBOARD',
					featureKey: FeatureEnum.FEATURE_DASHBOARD
				}
			},
			{
				title: 'Accounting',
				icon: 'credit-card-outline',
				data: {
					translationKey: 'MENU.ACCOUNTING'
				},
				children: [
					{
						title: 'Estimates',
						icon: 'file-outline',
						link: '/pages/accounting/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ESTIMATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_ESTIMATE
						}
					},
					{
						title: 'Estimates Received',
						icon: 'archive-outline',
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
						icon: 'file-text-outline',
						link: '/pages/accounting/invoices',
						pathMatch: 'full',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE
						}
					},
					{
						title: 'Invoices Recurring',
						icon: 'flip-outline',
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
						icon: 'archive',
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
						icon: 'plus-circle-outline',
						link: '/pages/accounting/income',
						data: {
							translationKey: 'MENU.INCOME',
							permissionKeys: [PermissionsEnum.ORG_INCOMES_VIEW],
							featureKey: FeatureEnum.FEATURE_INCOME
						}
					},
					{
						title: 'Expenses',
						icon: 'minus-circle-outline',
						link: '/pages/accounting/expenses',
						data: {
							translationKey: 'MENU.EXPENSES',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey: FeatureEnum.FEATURE_EXPENSE
						}
					},
					{
						title: 'Payments',
						icon: 'clipboard-outline',
						link: '/pages/accounting/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW],
							featureKey: FeatureEnum.FEATURE_PAYMENT
						}
					}
				]
			},
			{
				title: 'Sales',
				icon: 'trending-up-outline',
				link: '/pages/sales',
				data: {
					translationKey: 'MENU.SALES',
					permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
				},
				children: [
					{
						title: 'Proposals',
						icon: 'paper-plane-outline',
						link: '/pages/sales/proposals',
						data: {
							translationKey: 'MENU.PROPOSALS',
							permissionKeys: [
								PermissionsEnum.ORG_PROPOSALS_VIEW
							],
							featureKey: FeatureEnum.FEATURE_PROPOSAL
						}
					},
					{
						title: 'Estimates',
						icon: 'file-outline',
						link: '/pages/sales/invoices/estimates',
						data: {
							translationKey: 'MENU.ESTIMATES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.ESTIMATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_PROPOSAL
						}
					},
					{
						title: 'Invoices',
						icon: 'file-text-outline',
						link: '/pages/sales/invoices',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_INVOICE
						}
					},
					{
						title: 'Invoices Recurring',
						icon: 'flip-outline',
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
						icon: 'clipboard-outline',
						link: '/pages/sales/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW],
							featureKey: FeatureEnum.FEATURE_PAYMENT
						}
					},
					{
						title: 'Pipelines',
						icon: 'funnel-outline',
						link: '/pages/sales/pipelines',
						data: {
							translationKey: 'MENU.PIPELINES',
							permissionKeys: [
								PermissionsEnum.VIEW_SALES_PIPELINES
							],
							featureKey: FeatureEnum.FEATURE_PIPELINE
						}
					}
				]
			},
			{
				title: 'Tasks',
				icon: 'browser-outline',
				link: '/pages/tasks',
				data: {
					translationKey: 'MENU.TASKS'
				},
				children: [
					{
						title: 'Dashboard',
						icon: 'list-outline',
						link: '/pages/tasks/dashboard',
						data: {
							translationKey: 'MENU.DASHBOARD',
							featureKey: FeatureEnum.FEATURE_DASHBOARD_TASK
						}
					},
					{
						title: 'My Tasks',
						icon: 'person-outline',
						link: '/pages/tasks/me',
						data: {
							translationKey: 'MENU.MY_TASKS',
							hide: () => !this.isEmployee,
							featureKey: FeatureEnum.FEATURE_MY_TASK
						}
					},
					{
						title: "Team's Tasks",
						icon: 'people-outline',
						link: '/pages/tasks/team',
						data: {
							translationKey: 'MENU.TEAM_TASKS',
							featureKey: FeatureEnum.FEATURE_TEAM_TASK
						}
					}
				]
			},
			{
				title: 'Jobs',
				icon: 'briefcase-outline',
				link: '/pages/jobs',
				data: {
					translationKey: 'MENU.JOBS',
					featureKey: FeatureEnum.FEATURE_JOB
				},
				children: [
					{
						title: 'Employee',
						icon: 'people-outline',
						link: '/pages/jobs/employee',
						data: {
							translationKey: 'MENU.EMPLOYEES',
							permissionKeys: [
								PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW
							]
						}
					},
					{
						title: 'Browse',
						icon: 'list-outline',
						link: '/pages/jobs/search',
						data: {
							translationKey: 'MENU.JOBS_SEARCH'
						}
					},
					{
						title: 'Matching',
						icon: 'person-outline',
						link: '/pages/jobs/matching',
						data: {
							translationKey: 'MENU.JOBS_MATCHING',
							permissionKeys: [
								PermissionsEnum.ORG_JOB_MATCHING_VIEW
							]
						}
					},
					{
						title: 'Proposal Template',
						icon: 'file-text-outline',
						link: '/pages/jobs/proposal-template',
						data: {
							translationKey: 'MENU.PROPOSAL_TEMPLATE',
							permissionKeys: [
								PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW
							]
						}
					}
				]
			},
			{
				title: 'Employees',
				icon: 'people-outline',
				data: {
					translationKey: 'MENU.EMPLOYEES'
				},
				children: [
					{
						title: 'Manage',
						icon: 'list-outline',
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
						icon: 'trending-up-outline',
						link: '/pages/employees/activity',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIME_ACTIVITY',
							featureKey:
								FeatureEnum.FEATURE_EMPLOYEE_TIME_ACTIVITY
						}
					},
					{
						title: 'Timesheets',
						icon: 'clock-outline',
						link: '/pages/employees/timesheets',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIMESHEETS',
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMESHEETS
						}
					},
					{
						title: 'Appointments',
						icon: 'calendar-outline',
						link: '/pages/employees/appointments',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.APPOINTMENTS',
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_APPOINTMENT
						}
					},
					{
						title: 'Approvals',
						icon: 'flip-2-outline',
						link: '/pages/employees/approvals',
						data: {
							translationKey: 'MENU.APPROVALS',
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_APPROVAL
						}
					},
					{
						title: 'Employee Levels',
						icon: 'bar-chart-outline',
						link: `/pages/employees/employee-level`,
						data: {
							translationKey: 'MENU.EMPLOYEE_LEVEL',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_LEVEL
						}
					},
					{
						title: 'Positions',
						icon: 'award-outline',
						link: `/pages/employees/positions`,
						data: {
							translationKey: 'MENU.POSITIONS',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_POSITION
						}
					},
					{
						title: 'Time Off',
						icon: 'eye-off-2-outline',
						link: '/pages/employees/time-off',
						data: {
							translationKey: 'MENU.TIME_OFF',
							permissionKeys: [PermissionsEnum.ORG_TIME_OFF_VIEW],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_TIMEOFF
						}
					},
					{
						title: 'Recurring Expenses',
						icon: 'flip-outline',
						link: '/pages/employees/recurring-expenses',
						data: {
							translationKey: 'MENU.RECURRING_EXPENSE',
							permissionKeys: [
								PermissionsEnum.EMPLOYEE_EXPENSES_VIEW
							],
							featureKey:
								FeatureEnum.FEATURE_EMPLOYEE_RECURRING_EXPENSE
						}
					},
					{
						title: 'Candidates',
						icon: 'person-done-outline',
						link: '/pages/employees/candidates',
						data: {
							translationKey: 'MENU.CANDIDATES',
							permissionKeys: [
								PermissionsEnum.ORG_CANDIDATES_VIEW
							],
							featureKey: FeatureEnum.FEATURE_EMPLOYEE_CANDIDATE
						}
					}
				]
			},
			{
				title: 'Organization',
				icon: 'globe-2-outline',
				data: {
					translationKey: 'MENU.ORGANIZATION',
					withOrganizationShortcuts: true
				},
				children: [
					{
						title: 'Manage',
						icon: 'globe-2-outline',
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
						icon: 'shopping-bag-outline',
						link: '/pages/organization/equipment',
						data: {
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							translationKey: 'MENU.EQUIPMENT',
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_EQUIPMENT
						}
					},
					{
						title: 'Inventory',
						icon: 'grid-outline',
						link: '/pages/organization/inventory',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.INVENTORY',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_INVENTORY
						}
					},
					{
						title: 'Tags',
						icon: 'pricetags-outline',
						link: '/pages/organization/tags',
						data: {
							translationKey: 'MENU.TAGS',
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_TAG
						}
					},
					{
						title: 'Vendors',
						icon: 'car-outline',
						link: '/pages/organization/vendors',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.VENDORS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_VENDOR
						}
					},
					{
						title: 'Projects',
						icon: 'book-outline',
						link: `/pages/organization/projects`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.PROJECTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_PROJECT
						}
					},
					{
						title: 'Departments',
						icon: 'briefcase-outline',
						link: `/pages/organization/departments`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DEPARTMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_DEPARTMENT
						}
					},
					{
						title: 'Teams',
						icon: 'people-outline',
						link: `/pages/organization/teams`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EDIT.TEAMS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey: FeatureEnum.FEATURE_ORGANIZATION_TEAM
						}
					},
					{
						title: 'Documents',
						icon: 'file-text-outline',
						link: `/pages/organization/documents`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DOCUMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_DOCUMENT
						}
					},
					{
						title: 'Employment Types',
						icon: 'layers-outline',
						link: `/pages/organization/employment-types`,
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EMPLOYMENT_TYPES',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE
						}
					},
					{
						title: 'Expense Recurring',
						icon: 'flip-outline',
						link: '/pages/organization/expense-recurring',
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EXPENSE_RECURRING',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW],
							featureKey:
								FeatureEnum.FEATURE_ORGANIZATION_RECURRING_EXPENSE
						}
					},
					{
						title: 'Help Center',
						icon: 'question-mark-circle-outline',
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
				icon: 'book-open-outline',
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
						icon: 'book-open-outline',
						link: `/pages/contacts/visitors`,
						data: {
							translationKey: 'CONTACTS_PAGE.VISITORS'
						}
					},
					{
						title: 'Leads',
						icon: 'book-open-outline',
						link: `/pages/contacts/leads`,
						data: {
							translationKey: 'CONTACTS_PAGE.LEADS'
						}
					},
					{
						title: 'Customers',
						icon: 'book-open-outline',
						link: `/pages/contacts/customers`,
						data: {
							translationKey: 'CONTACTS_PAGE.CUSTOMERS'
						}
					},
					{
						title: 'Clients',
						icon: 'book-open-outline',
						link: `/pages/contacts/clients`,
						data: {
							translationKey: 'CONTACTS_PAGE.CLIENTS'
						}
					}
				]
			},
			{
				title: 'Goals',
				icon: 'flag-outline',
				data: {
					translationKey: 'MENU.GOALS'
				},
				children: [
					{
						title: 'Manage',
						link: '/pages/goals',
						pathMatch: 'full',
						icon: 'list-outline',
						data: {
							translationKey: 'MENU.MANAGE',
							featureKey: FeatureEnum.FEATURE_GOAL
						}
					},
					{
						title: 'Report',
						link: '/pages/goals/reports',
						icon: 'file-text-outline',
						data: {
							translationKey: 'MENU.REPORTS',
							featureKey: FeatureEnum.FEATURE_GOAL_REPORT
						}
					},
					{
						title: 'Settings',
						link: '/pages/goals/settings',
						icon: 'settings-outline',
						data: {
							translationKey: 'MENU.SETTINGS',
							featureKey: FeatureEnum.FEATURE_GOAL_SETTING
						}
					}
				]
			},
			{
				title: 'Reports',
				icon: 'file-text-outline',
				link: '/pages/reports',
				data: {
					translationKey: 'MENU.REPORTS',
					featureKey: FeatureEnum.FEATURE_REPORT
				},
				children: [
					{
						title: 'All Reports',
						link: '/pages/reports/all',
						icon: 'bar-chart-outline',
						data: {
							translationKey: 'MENU.ALL_REPORTS'
						}
					},
					...this.reportMenuItems
				]
			},
			{
				title: 'Admin',
				group: true,
				data: {
					translationKey: 'MENU.ADMIN',
					permissionKeys: [
						PermissionsEnum.ORG_EMPLOYEES_VIEW,
						PermissionsEnum.ORG_USERS_VIEW,
						PermissionsEnum.ALL_ORG_EDIT,
						PermissionsEnum.ALL_ORG_VIEW
					]
				}
			},
			{
				title: 'Users',
				icon: 'people-outline',
				link: '/pages/users',
				data: {
					translationKey: 'MENU.USERS',
					permissionKeys: [
						PermissionsEnum.ALL_ORG_VIEW,
						PermissionsEnum.ORG_USERS_VIEW
					],
					featureKey: FeatureEnum.FEATURE_USER
				}
			},
			{
				title: 'Organizations',
				icon: 'globe-outline',
				link: '/pages/organizations',
				data: {
					translationKey: 'MENU.ORGANIZATIONS',
					permissionKeys: [
						PermissionsEnum.ALL_ORG_VIEW,
						PermissionsEnum.ORG_EXPENSES_EDIT
					],
					featureKey: FeatureEnum.FEATURE_ORGANIZATIONS
				}
			},
			{
				title: 'Integrations',
				icon: 'pantone-outline',
				link: '/pages/integrations',
				pathMatch: 'prefix',
				data: {
					translationKey: 'MENU.INTEGRATIONS',
					permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
					featureKey: FeatureEnum.FEATURE_APP_INTEGRATION
				}
			},
			{
				title: 'Settings',
				icon: 'settings-outline',
				data: {
					translationKey: 'MENU.SETTINGS'
				},
				children: [
					{
						title: 'General',
						icon: 'edit-outline',
						link: '/pages/settings/general',
						data: {
							translationKey: 'MENU.GENERAL',
							featureKey: FeatureEnum.FEATURE_SETTING
						}
					},
					{
						title: 'Features',
						icon: 'pantone-outline',
						link: '/pages/settings/features',
						data: {
							translationKey: 'MENU.FEATURES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_EDIT,
								PermissionsEnum.ALL_ORG_VIEW
							]
						}
					},
					{
						title: 'Email History',
						icon: 'email-outline',
						link: '/pages/settings/email-history',
						data: {
							translationKey: 'MENU.EMAIL_HISTORY',
							permissionKeys: [PermissionsEnum.VIEW_ALL_EMAILS],
							featureKey: FeatureEnum.FEATURE_EMAIL_HISTORY
						}
					},
					{
						title: 'Email Templates',
						icon: 'email-outline',
						link: '/pages/settings/email-templates',
						data: {
							translationKey: 'MENU.EMAIL_TEMPLATES',
							permissionKeys: [
								PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES
							],
							featureKey: FeatureEnum.FEATURE_EMAIL_TEMPLATE
						}
					},
					{
						title: 'Accounting Templates',
						icon: 'clipboard-outline',
						link: '/pages/settings/accounting-templates',
						data: {
							translationKey: 'MENU.ACCOUNTING_TEMPLATES',
							permissionKeys: [
								PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES
							]
						}
					},
					{
						title: 'Import/Export',
						icon: 'flip-outline',
						link: '/pages/settings/import-export',
						data: {
							translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT',
							permissionKeys: [
								PermissionsEnum.IMPORT_EXPORT_VIEW
							],
							featureKey: FeatureEnum.FEATURE_IMPORT_EXPORT
						}
					},
					{
						title: 'File storage',
						icon: 'file',
						link: '/pages/settings/file-storage',
						data: {
							translationKey: 'MENU.FILE_STORAGE',
							permissionKeys: [PermissionsEnum.FILE_STORAGE_VIEW],
							featureKey: FeatureEnum.FEATURE_FILE_STORAGE
						}
					},
					{
						title: 'Payment Gateways',
						icon: 'credit-card-outline',
						data: {
							translationKey: 'MENU.PAYMENT_GATEWAYS',
							permissionKeys: [
								PermissionsEnum.PAYMENT_GATEWAY_VIEW
							],
							featureKey: FeatureEnum.FEATURE_PAYMENT_GATEWAY
						}
					},
					{
						title: 'SMS Gateways',
						icon: 'at-outline',
						link: '/pages/settings/sms-gateway',
						data: {
							translationKey: 'MENU.SMS_GATEWAYS',
							permissionKeys: [PermissionsEnum.SMS_GATEWAY_VIEW],
							featureKey: FeatureEnum.FEATURE_SMS_GATEWAY
						}
					},
					{
						title: 'Custom SMTP',
						icon: 'at-outline',
						link: '/pages/settings/custom-smtp',
						data: {
							translationKey: 'MENU.CUSTOM_SMTP',
							permissionKeys: [PermissionsEnum.CUSTOM_SMTP_VIEW],
							featureKey: FeatureEnum.FEATURE_SMTP
						}
					},
					{
						title: 'Roles & Permissions',
						link: '/pages/settings/roles',
						icon: 'award-outline',
						data: {
							translationKey: 'MENU.ROLES',
							permissionKeys: [
								PermissionsEnum.CHANGE_ROLES_PERMISSIONS
							],
							featureKey: FeatureEnum.FEATURE_ROLES_PERMISSION
						}
					},
					{
						title: 'Danger Zone',
						link: '/pages/settings/danger-zone',
						icon: 'alert-triangle-outline',
						data: {
							translationKey: 'MENU.DANGER_ZONE'
						}
					}
				]
			}
		];
	}

	async ngOnInit() {
		await this._createEntryPoint();
		this._applyTranslationOnSmartTable();

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (org) => {
				this.checkForEmployee();
				this._selectedOrganization = org;

				if (org) {
					await this.reportService.getReportMenuItems({
						organizationId: org.id
					});
				}
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts
				);
			});
		this.store.userRolePermissions$
			.pipe(
				filter((permissions) => permissions.length > 0),
				untilDestroyed(this)
			)
			.subscribe((data) => {
				const permissions = data.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
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
			.pipe(untilDestroyed(this))
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

	/*
	 * This is app entry point after login
	 */
	private async _createEntryPoint() {
		const id = this.store.userId;
		if (!id) return;

		this.user = await this.usersService.getMe([
			'employee',
			'role',
			'role.rolePermissions',
			'tenant',
			'tenant.featureOrganizations',
			'tenant.featureOrganizations.feature'
		]);

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
		const { tenant } = this.user;
		this.store.featureTenant = tenant.featureOrganizations.filter(
			(item) => !item.organizationId
		);

		//only enabled permissions assign to logged in user
		this.store.userRolePermissions = this.user.role.rolePermissions.filter(
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
				item.hidden =
					!withOrganizationShortcuts || !this._selectedOrganization;
				if (!item.hidden) {
					item.link =
						item.data.urlPrefix +
						this._selectedOrganization.id +
						item.data.urlPostfix;
				}
			}
		}

		// enabled/disabled features from here
		if (item.data.hasOwnProperty('featureKey')) {
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

	checkForEmployee() {
		const { tenantId, id: userId } = this.store.user;
		this.employeeService
			.getEmployeeByUserId(userId, [], { tenantId })
			.then(({ success }) => {
				this.isEmployee = success;
			});
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadItems(
				this.selectorService.showSelectors(this.router.url)
					.showOrganizationShortcuts
			);
		});
	}

	ngOnDestroy() {}
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IOrganization, IUser, PermissionsEnum } from '@gauzy/models';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { Store } from '../@core/services/store.service';
import { SelectorService } from '../@core/utils/selector.service';
import { EmployeesService, UsersService } from '../@core/services';
import { NgxPermissionsService } from 'ngx-permissions';
import { ReportService } from './reports/all-report/report.server';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { chain } from 'underscore';
import { AuthStrategy } from '../@core/auth/auth-strategy.service';

interface GaMenuItem extends NbMenuItem {
	data: {
		translationKey: string; //Translation key for the title, mandatory for all items
		permissionKeys?: PermissionsEnum[]; //Check permissions and hide item if any given permission is not present
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
export class PagesComponent implements OnInit, OnDestroy {
	basicMenu: GaMenuItem[];
	adminMenu: GaMenuItem[];
	isAdmin: boolean;
	isEmployee: boolean;
	_selectedOrganization: IOrganization;
	user: IUser;
	menu: NbMenuItem[] = [];
	reportMenuItems: NbMenuItem[];

	constructor(
		private employeeService: EmployeesService,
		public translate: TranslateService,
		private store: Store,
		private reportService: ReportService,
		private selectorService: SelectorService,
		private router: Router,
		private ngxPermissionsService: NgxPermissionsService,
		private readonly usersService: UsersService,
		private readonly authStrategy: AuthStrategy
	) {}

	getMenuItems(): GaMenuItem[] {
		return [
			{
				title: 'Dashboard',
				icon: 'home-outline',
				link: '/pages/dashboard',
				pathMatch: 'prefix',
				home: true,
				data: {
					translationKey: 'MENU.DASHBOARD'
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
							]
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
							]
						}
					},
					{
						title: 'Invoices',
						icon: 'file-text-outline',
						link: '/pages/accounting/invoices',
						data: {
							translationKey: 'MENU.INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							]
						}
					},
					{
						title: 'Invoices Recurring',
						icon: 'flip-outline',
						link: '/pages/accounting/invoices/recurring',
						data: {
							translationKey: 'MENU.RECURRING_INVOICES',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							]
						}
					},
					{
						title: 'Invoices Received',
						icon: 'archive',
						link: '/pages/accounting/invoices/received-invoices',
						data: {
							translationKey: 'MENU.INVOICES_RECEIVED',
							permissionKeys: [
								PermissionsEnum.ALL_ORG_VIEW,
								PermissionsEnum.INVOICES_VIEW
							]
						}
					},
					{
						title: 'Income',
						icon: 'plus-circle-outline',
						link: '/pages/accounting/income',
						data: {
							translationKey: 'MENU.INCOME',
							permissionKeys: [PermissionsEnum.ORG_INCOMES_VIEW]
						}
					},
					{
						title: 'Expenses',
						icon: 'minus-circle-outline',
						link: '/pages/accounting/expenses',
						data: {
							translationKey: 'MENU.EXPENSES',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW]
						}
					},
					{
						title: 'Payments',
						icon: 'clipboard-outline',
						link: '/pages/accounting/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW]
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
							permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
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
							]
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
							]
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
							]
						}
					},
					{
						title: 'Payments',
						icon: 'clipboard-outline',
						link: '/pages/sales/payments',
						data: {
							translationKey: 'MENU.PAYMENTS',
							permissionKeys: [PermissionsEnum.ORG_PAYMENT_VIEW]
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
							]
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
							translationKey: 'MENU.DASHBOARD'
						}
					},
					{
						title: 'My Tasks',
						icon: 'person-outline',
						link: '/pages/tasks/me',
						data: {
							translationKey: 'MENU.MY_TASKS',
							hide: () => !this.isEmployee
						}
					},
					{
						title: "Team's Tasks",
						icon: 'people-outline',
						link: '/pages/tasks/team',
						data: {
							translationKey: 'MENU.TEAM_TASKS'
						}
					}
				]
			},
			{
				title: 'Jobs',
				icon: 'briefcase-outline',
				link: '/pages/jobs',
				data: {
					translationKey: 'MENU.JOBS'
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
						data: {
							translationKey: 'MENU.MANAGE',
							permissionKeys: [PermissionsEnum.ORG_EMPLOYEES_VIEW]
						}
					},
					{
						title: 'Time & Activity',
						icon: 'trending-up-outline',
						link: '/pages/employees/activity',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIME_ACTIVITY'
						}
					},
					{
						title: 'Timesheets',
						icon: 'clock-outline',
						link: '/pages/employees/timesheets',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.TIMESHEETS'
						}
					},
					{
						title: 'Appointments',
						icon: 'calendar-outline',
						link: '/pages/employees/appointments',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.APPOINTMENTS'
						}
					},
					{
						title: 'Approvals',
						icon: 'flip-2-outline',
						link: '/pages/employees/approvals',
						data: {
							translationKey: 'MENU.APPROVALS'
						}
					},
					{
						title: 'Employee Levels',
						icon: 'bar-chart-outline',
						link: `/pages/employees/employee-level`,
						data: {
							translationKey: 'MENU.EMPLOYEE_LEVEL',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW]
						}
					},
					{
						title: 'Positions',
						icon: 'award-outline',
						link: `/pages/employees/positions`,
						data: {
							translationKey: 'MENU.POSITIONS',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW]
						}
					},
					{
						title: 'Time Off',
						icon: 'eye-off-2-outline',
						link: '/pages/employees/time-off',
						data: {
							translationKey: 'MENU.TIME_OFF',
							permissionKeys: [PermissionsEnum.ORG_TIME_OFF_VIEW]
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
							]
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
							]
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
							translationKey: 'MENU.MANAGE'
						}
					},
					{
						title: 'Equipment',
						icon: 'shopping-bag-outline',
						link: '/pages/organization/equipment',
						data: {
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
							translationKey: 'MENU.EQUIPMENT'
						}
					},
					{
						title: 'Inventory',
						icon: 'grid-outline',
						link: '/pages/organization/inventory',
						pathMatch: 'prefix',
						data: {
							translationKey: 'MENU.INVENTORY',
							permissionKeys: [PermissionsEnum.ALL_ORG_VIEW]
						}
					},
					{
						title: 'Tags',
						icon: 'pricetags-outline',
						link: '/pages/organization/tags',
						data: {
							translationKey: 'MENU.TAGS'
						}
					},
					{
						title: 'Vendors',
						icon: 'car-outline',
						link: '/pages/organization/vendors',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.VENDORS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT]
						}
					},
					{
						title: 'Projects',
						icon: 'book-outline',
						link: `/pages/organization/projects`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.PROJECTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT]
						}
					},
					{
						title: 'Departments',
						icon: 'briefcase-outline',
						link: `/pages/organization/departments`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DEPARTMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT]
						}
					},
					{
						title: 'Teams',
						icon: 'people-outline',
						link: `/pages/organization/teams`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.EDIT.TEAMS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT]
						}
					},
					{
						title: 'Documents',
						icon: 'file-text-outline',
						link: `/pages/organization/documents`,
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.DOCUMENTS',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT]
						}
					},
					{
						title: 'Employment Types',
						icon: 'layers-outline',
						link: `/pages/organization/employment-types`,
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EMPLOYMENT_TYPE',
							permissionKeys: [PermissionsEnum.ALL_ORG_EDIT]
						}
					},
					{
						title: 'Expense Recurring',
						icon: 'flip-outline',
						link: '/pages/organization/expense-recurring',
						data: {
							translationKey:
								'ORGANIZATIONS_PAGE.EXPENSE_RECURRING',
							permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW]
						}
					},
					{
						title: 'Help Center',
						icon: 'question-mark-circle-outline',
						link: '/pages/organization/help-center',
						data: {
							translationKey: 'ORGANIZATIONS_PAGE.HELP_CENTER'
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
					]
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
						icon: 'list-outline',
						data: {
							translationKey: 'MENU.MANAGE'
						}
					},
					{
						title: 'Report',
						link: '/pages/goals/reports',
						icon: 'file-text-outline',
						data: {
							translationKey: 'MENU.REPORTS'
						}
					},
					{
						title: 'Settings',
						link: '/pages/goals/settings',
						icon: 'settings-outline',
						data: {
							translationKey: 'MENU.SETTINGS'
						}
					}
				]
			},
			{
				title: 'Reports',
				icon: 'file-text-outline',
				link: '/pages/reports',
				data: {
					translationKey: 'MENU.REPORTS'
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
					]
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
					]
				}
			},
			{
				title: 'Integrations',
				icon: 'pantone-outline',
				link: '/pages/integrations',
				pathMatch: 'prefix',
				data: {
					translationKey: 'MENU.INTEGRATIONS',
					permissionKeys: [PermissionsEnum.INTEGRATION_VIEW]
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
							translationKey: 'MENU.GENERAL'
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
							permissionKeys: [PermissionsEnum.VIEW_ALL_EMAILS]
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
							]
						}
					},
					{
						title: 'Import/Export',
						icon: 'flip-outline',
						link: '/pages/settings/import-export',
						data: {
							translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT',
							permissionKeys: [PermissionsEnum.IMPORT_EXPORT_VIEW]
						}
					},
					{
						title: 'File storage',
						icon: 'file',
						link: '/pages/settings/file-storage',
						data: {
							translationKey: 'MENU.FILE_STORAGE',
							permissionKeys: [PermissionsEnum.FILE_STORAGE_VIEW]
						}
					},
					{
						title: 'Payment Gateways',
						icon: 'credit-card-outline',
						data: {
							translationKey: 'MENU.PAYMENT_GATEWAYS',
							permissionKeys: [
								PermissionsEnum.PAYMENT_GATEWAY_VIEW
							]
						}
					},
					{
						title: 'SMS Gateways',
						icon: 'at-outline',
						link: '/pages/settings/sms-gateway',
						data: {
							translationKey: 'MENU.SMS_GATEWAYS',
							permissionKeys: [PermissionsEnum.SMS_GATEWAY_VIEW]
						}
					},
					{
						title: 'Custom SMTP',
						icon: 'at-outline',
						link: '/pages/settings/custom-smtp',
						data: {
							translationKey: 'MENU.CUSTOM_SMTP',
							permissionKeys: [PermissionsEnum.CUSTOM_SMTP_VIEW]
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
							]
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
		this._createEntryPoint();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (org) => {
				this._selectedOrganization = org;
				await this.checkForEmployee();
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
			'tenant'
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

		if (item.children) {
			item.children.forEach((childItem) => {
				this.refreshMenuItem(childItem, withOrganizationShortcuts);
			});
		}
	}

	async checkForEmployee() {
		const { tenantId } = this.store.user;
		this.isEmployee = (
			await this.employeeService.getEmployeeByUserId(
				this.store.userId,
				[],
				{ tenantId }
			)
		).success;
	}

	getTranslation(prefix: string) {
		let result = prefix;
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
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

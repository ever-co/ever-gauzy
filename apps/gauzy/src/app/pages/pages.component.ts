import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Organization, PermissionsEnum } from '@gauzy/models';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from '../@core/services/auth.service';
import { Store } from '../@core/services/store.service';
import { SelectorService } from '../@core/utils/selector.service';
import { EmployeesService } from '../@core/services';

interface GaMenuItem extends NbMenuItem {
	data: {
		translationKey: string; //Translation key for the title, mandatory for all items
		permissionKeys?: PermissionsEnum[]; //Check permissions and hide item if any given permission is not present
		withOrganizationShortcuts?: boolean; //Declare if the sidebar item has organization level shortcuts
		hide?: () => boolean; //Hide the menu item if this returns true
	};
}

@Component({
	selector: 'ngx-pages',
	styleUrls: ['pages.component.scss'],
	template: `
		<ngx-one-column-layout *ngIf="!!menu">
			<nb-menu [items]="menu"></nb-menu>
			<router-outlet></router-outlet>
		</ngx-one-column-layout>
	`
})
export class PagesComponent implements OnInit, OnDestroy {
	basicMenu: GaMenuItem[];
	adminMenu: GaMenuItem[];
	private _ngDestroy$ = new Subject<void>();
	isAdmin: boolean;
	isEmployee: boolean;
	_selectedOrganization: Organization;

	MENU_ITEMS: GaMenuItem[] = [
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
						translationKey: 'MENU.ESTIMATES'
					}
				},
				{
					title: 'Estimates Received',
					icon: 'archive-outline',
					link: '/pages/accounting/invoices/received-estimates',
					data: {
						translationKey: 'MENU.ESTIMATES_RECEIVED'
					}
				},
				{
					title: 'Invoices',
					icon: 'file-text-outline',
					link: '/pages/accounting/invoices',
					data: {
						permissionKeys: [
							PermissionsEnum.ALL_ORG_VIEW,
							PermissionsEnum.INVOICES_VIEW
						],
						translationKey: 'MENU.INVOICES'
					}
				},
				{
					title: 'Invoices Recurring',
					icon: 'flip-outline',
					link: '/pages/accounting/recurring-invoices',
					data: {
						permissionKeys: [PermissionsEnum.INVOICES_VIEW],
						translationKey: 'MENU.RECURRING_INVOICES'
					}
				},
				{
					title: 'Invoices Received',
					icon: 'archive',
					link: '/pages/accounting/invoices/received-invoices',
					data: {
						translationKey: 'MENU.INVOICES_RECEIVED'
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
						translationKey: 'MENU.PAYMENTS'
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
						translationKey: 'MENU.ESTIMATES'
					}
				},
				{
					title: 'Invoices',
					icon: 'file-text-outline',
					link: '/pages/sales/invoices',
					data: {
						permissionKeys: [
							PermissionsEnum.ALL_ORG_VIEW,
							PermissionsEnum.INVOICES_VIEW
						],
						translationKey: 'MENU.INVOICES'
					}
				},
				{
					title: 'Invoices Recurring',
					icon: 'flip-outline',
					link: '/pages/sales/recurring-invoices',
					data: {
						permissionKeys: [PermissionsEnum.INVOICES_VIEW],
						translationKey: 'MENU.RECURRING_INVOICES'
					}
				},
				{
					title: 'Payments',
					icon: 'clipboard-outline',
					link: '/pages/sales/payments',
					data: {
						translationKey: 'MENU.PAYMENTS'
					}
				},
				{
					title: 'Pipelines',
					icon: 'funnel-outline',
					link: '/pages/sales/pipelines',
					data: {
						translationKey: 'MENU.PIPELINES',
						permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
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
			title: 'Employees',
			icon: 'people-outline',
			data: {
				translationKey: 'MENU.EMPLOYEES',
				permissionKeys: [
					PermissionsEnum.ORG_EMPLOYEES_VIEW,
					PermissionsEnum.ORG_EXPENSES_EDIT
				]
			},
			children: [
				{
					title: 'Manage',
					icon: 'list-outline',
					link: '/pages/employees',
					data: {
						translationKey: 'MENU.MANAGE'
					}
				},
				{
					title: 'Activity',
					icon: 'trending-up-outline',
					link: '/pages/employees/activity',
					pathMatch: 'prefix',
					data: {
						translationKey: 'MENU.ACTIVITY'
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
					title: 'Schedules',
					icon: 'calendar-outline',
					link: '/pages/employees/schedules',
					pathMatch: 'prefix',
					data: {
						translationKey: 'MENU.SCHEDULES'
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
					title: 'Time Off',
					icon: 'eye-off-2-outline',
					link: '/pages/employees/time-off',
					data: {
						translationKey: 'MENU.TIME_OFF',
						permissionKeys: [PermissionsEnum.ORG_TIME_OFF_VIEW]
					}
				},
				{
					title: 'Candidates',
					icon: 'person-done-outline',
					link: '/pages/employees/candidates',
					data: {
						translationKey: 'MENU.CANDIDATES'
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
					data: {
						// permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
						translationKey: 'MENU.INVENTORY'
					}
				},
				{
					title: 'Tags',
					icon: 'pricetags-outline',
					link: '/pages/organization/tags',
					data: {
						translationKey: 'MENU.TAGS'
						//   permissionKeys: [],
					}
				},
				{
					title: 'Contacts',
					icon: 'book-open-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/contacts',
						translationKey: 'ORGANIZATIONS_PAGE.CONTACTS'
					}
				},
				{
					title: 'Vendors',
					icon: 'car-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/vendors',
						translationKey: 'ORGANIZATIONS_PAGE.VENDORS'
					}
				},
				{
					title: 'Projects',
					icon: 'book-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/projects',
						translationKey: 'ORGANIZATIONS_PAGE.PROJECTS'
					}
				},
				{
					title: 'Positions',
					icon: 'award-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/positions',
						translationKey: 'ORGANIZATIONS_PAGE.POSITIONS'
					}
				},
				{
					title: 'Departments',
					icon: 'briefcase-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/departments',
						translationKey: 'ORGANIZATIONS_PAGE.DEPARTMENTS'
					}
				},
				{
					title: 'Teams',
					icon: 'people-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/teams',
						translationKey: 'ORGANIZATIONS_PAGE.EDIT.TEAMS'
					}
				},
				{
					title: 'Documents',
					icon: 'file-text-outline',
					link: `/pages/organizations/`,
					data: {
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/documents',
						translationKey: 'ORGANIZATIONS_PAGE.DOCUMENTS'
					}
				},
				{
					title: 'Help Center',
					icon: 'question-mark-circle-outline',
					link: '/pages/organization/help-center',
					data: {
						translationKey: 'MENU.HELP_CENTER'
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
					title: 'Time Reports',
					link: '/pages/reports/time',
					icon: 'clock-outline',
					data: {
						translationKey: 'MENU.TIME_REPORTS'
					}
				},
				{
					title: 'Accounting Reports',
					link: '/pages/reports/accounting',
					icon: 'credit-card-outline',
					data: {
						translationKey: 'MENU.ACCOUNTING_REPORTS'
					}
				}
			]
		},
		{
			title: 'Admin',
			group: true,
			data: {
				permissionKeys: [
					PermissionsEnum.ORG_EMPLOYEES_VIEW,
					PermissionsEnum.ORG_USERS_VIEW,
					PermissionsEnum.ALL_ORG_EDIT,
					PermissionsEnum.ALL_ORG_VIEW
				],
				translationKey: 'MENU.ADMIN'
			}
		},
		{
			title: 'Users',
			icon: 'people-outline',
			link: '/pages/users',
			data: {
				permissionKeys: [PermissionsEnum.ORG_USERS_VIEW],
				translationKey: 'MENU.USERS'
			}
		},
		{
			title: 'Organizations',
			icon: 'globe-outline',
			link: '/pages/organizations',
			data: {
				permissionKeys: [
					PermissionsEnum.ALL_ORG_VIEW,
					PermissionsEnum.ORG_EXPENSES_EDIT
				],
				translationKey: 'MENU.ORGANIZATIONS'
			}
		},
		{
			title: 'Integrations',
			icon: 'pantone-outline',
			link: '/pages/integrations',
			pathMatch: 'prefix',
			data: {
				translationKey: 'MENU.INTEGRATIONS'
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
					title: 'Email History',
					icon: 'email-outline',
					link: '/pages/settings/email-history',
					data: {
						translationKey: 'MENU.EMAIL_HISTORY'
						// permissionKeys: [
						// 	PermissionsEnum.VIEW_ALL_EMAILS
						// ]
					}
				},
				{
					title: 'Email Templates',
					icon: 'email-outline',
					link: '/pages/settings/email-templates',
					data: {
						translationKey: 'MENU.EMAIL_TEMPLATES'
					}
				},
				{
					title: 'Import/Export',
					icon: 'flip-outline',
					data: {
						translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT'
					},
					children: [
						{
							title: 'Export',
							icon: 'download-outline',
							link: '/pages/settings/import-export/export',
							data: {
								translationKey: 'MENU.IMPORT_EXPORT.EXPORT'
							}
						},
						{
							title: 'Import',
							icon: 'upload-outline',
							link: '/pages/settings/import-export/import',
							data: {
								translationKey: 'MENU.IMPORT_EXPORT.IMPORT'
							}
						}
					]
				},
				{
					title: 'Payment Gateways',
					icon: 'credit-card-outline',
					data: {
						translationKey: 'MENU.PAYMENT_GATEWAYS'
					}
				},
				{
					title: 'Custom SMTP',
					icon: 'at-outline',
					data: {
						translationKey: 'MENU.CUSTOM_SMTP'
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

	menu: NbMenuItem[] = this.MENU_ITEMS;

	constructor(
		private authService: AuthService,
		private employeeService: EmployeesService,
		private translate: TranslateService,
		private store: Store,
		private selectorService: SelectorService,
		private router: Router
	) {}

	async ngOnInit() {
		await this.checkForEmployee();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				this._selectedOrganization = org;
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts
				);
			});

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts
				);
			});

		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((e) => {
				this.loadItems(
					this.selectorService.showSelectors(e['url'])
						.showOrganizationShortcuts
				);
			});
	}

	loadItems(
		withOrganizationShortcuts: boolean,
		forceTranslate: boolean = false
	) {
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
		this.isEmployee = (
			await this.employeeService.getEmployeeByUserId(this.store.userId)
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
		this.translate.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadItems(
					this.selectorService.showSelectors(this.router.url)
						.showOrganizationShortcuts,
					true
				);
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

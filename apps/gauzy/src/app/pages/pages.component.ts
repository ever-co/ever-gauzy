import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Organization, PermissionsEnum, RolesEnum } from '@gauzy/models';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { filter, first, takeUntil } from 'rxjs/operators';
import { AuthService } from '../@core/services/auth.service';
import { Store } from '../@core/services/store.service';
import { SelectorService } from '../@core/utils/selector.service';

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
	basicMenu: NbMenuItem[];
	adminMenu: NbMenuItem[];
	private _ngDestroy$ = new Subject<void>();
	isAdmin: boolean;
	_selectedOrganization: Organization;

	MENU_ITEMS: NbMenuItem[] = [
		{
			title: 'Dashboard',
			icon: 'home-outline',
			link: '/pages/dashboard',
			pathMatch: 'prefix',
			home: true,
			data: {
				translated: false,
				translationKey: 'MENU.DASHBOARD'
			}
		},
		{
			title: 'Accounting',
			icon: 'credit-card-outline',
			data: {
				translated: false,
				translationKey: 'MENU.ACCOUNTING'
			},
			children: [
				{
					title: 'Estimates',
					icon: 'file-outline',
					link: '/pages/accounting/invoices/estimates',
					data: {
						translated: false,
						translationKey: 'MENU.ESTIMATES'
					}
				},
				{
					title: 'Estimates Received',
					icon: 'archive-outline',
					link: '/pages/accounting/invoices/received-estimates',
					data: {
						translated: false,
						translationKey: 'MENU.ESTIMATES_RECEIVED'
					}
				},
				{
					title: 'Invoices',
					icon: 'file-text-outline',
					link: '/pages/accounting/invoices',
					data: {
						translated: false,
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
						translated: false,
						permissionKeys: [PermissionsEnum.INVOICES_VIEW],
						translationKey: 'MENU.RECURRING_INVOICES'
					}
				},
				{
					title: 'Invoices Received',
					icon: 'archive',
					link: '/pages/accounting/invoices/received-invoices',
					data: {
						translated: false,
						translationKey: 'MENU.INVOICES_RECEIVED'
					}
				},
				{
					title: 'Income',
					icon: 'plus-circle-outline',
					link: '/pages/accounting/income',
					data: {
						translated: false,
						translationKey: 'MENU.INCOME',
						permissionKeys: [PermissionsEnum.ORG_INCOMES_VIEW]
					}
				},
				{
					title: 'Expenses',
					icon: 'minus-circle-outline',
					link: '/pages/accounting/expenses',
					data: {
						translated: false,
						translationKey: 'MENU.EXPENSES',
						permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW]
					}
				},
				{
					title: 'Payments',
					icon: 'clipboard-outline',
					link: '/pages/accounting/payments',
					data: {
						translated: false,
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
				translated: false,
				translationKey: 'MENU.SALES',
				permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
			},
			children: [
				{
					title: 'Proposals',
					icon: 'paper-plane-outline',
					link: '/pages/sales/proposals',
					hidden: false,
					data: {
						translated: false,
						translationKey: 'MENU.PROPOSALS',
						permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
					}
				},
				{
					title: 'Estimates',
					icon: 'file-outline',
					link: '/pages/sales/invoices/estimates',
					data: {
						translated: false,
						translationKey: 'MENU.ESTIMATES'
					}
				},
				{
					title: 'Invoices',
					icon: 'file-text-outline',
					link: '/pages/sales/invoices',
					data: {
						translated: false,
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
						translated: false,
						permissionKeys: [PermissionsEnum.INVOICES_VIEW],
						translationKey: 'MENU.RECURRING_INVOICES'
					}
				},
				{
					title: 'Payments',
					icon: 'clipboard-outline',
					link: '/pages/sales/payments',
					data: {
						translated: false,
						translationKey: 'MENU.PAYMENTS'
					}
				},
				{
					title: 'Pipelines',
					icon: 'funnel-outline',
					link: '/pages/sales/pipelines',
					hidden: false,
					data: {
						translated: false,
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
				translated: false,
				translationKey: 'MENU.TASKS'
			},
			children: [
				{
					title: 'Dashboard',
					icon: 'list-outline',
					link: '/pages/tasks/dashboard',
					data: {
						translated: false,
						translationKey: 'MENU.DASHBOARD'
					}
				},
				{
					title: 'My Tasks',
					icon: 'person-outline',
					link: '/pages/tasks/me',
					data: {
						translated: false,
						translationKey: 'MENU.MY_TASKS'
					}
				},
				{
					title: "Team's Tasks",
					icon: 'people-outline',
					link: '/pages/tasks/team',
					data: {
						translated: false,
						translationKey: 'MENU.TEAM_TASKS'
					}
				}
			]
		},
		{
			title: 'Employees',
			icon: 'people-outline',
			data: {
				translated: false,
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
						translated: false,
						translationKey: 'MENU.MANAGE'
					}
				},
				{
					title: 'Activity',
					icon: 'trending-up-outline',
					link: '/pages/employees/activity',
					data: {
						translated: false,
						translationKey: 'MENU.ACTIVITY'
					}
				},
				{
					title: 'Timesheets',
					icon: 'clock-outline',
					link: '/pages/employees/timesheets',
					data: {
						translated: false,
						translationKey: 'MENU.TIMESHEETS'
					}
				},
				{
					title: 'Schedules',
					icon: 'calendar-outline',
					link: '/pages/employees/schedules',
					data: {
						translated: false,
						translationKey: 'MENU.SCHEDULES'
					}
				},
				{
					title: 'Appointments',
					icon: 'calendar-outline',
					link: '/pages/employees/appointments',
					pathMatch: 'prefix',
					data: {
						translated: false,
						translationKey: 'MENU.APPOINTMENTS'
					}
				},
				{
					title: 'Event Types',
					icon: 'calendar-outline',
					link: '/pages/employees/event-types',
					pathMatch: 'prefix',
					data: {
						translated: false,
						translationKey: 'MENU.EVENT_TYPES'
					}
				},
				{
					title: 'Approvals',
					icon: 'flip-2-outline',
					link: '/pages/employees/approvals',
					data: {
						translated: false,
						translationKey: 'MENU.APPROVALS'
					}
				},
				{
					title: 'Time Off',
					icon: 'eye-off-2-outline',
					link: '/pages/employees/time-off',
					data: {
						translated: false,
						translationKey: 'MENU.TIME_OFF',
						permissionKeys: [PermissionsEnum.ORG_TIME_OFF_VIEW]
					}
				},
				{
					title: 'Candidates',
					icon: 'person-done-outline',
					link: '/pages/employees/candidates',
					data: {
						translated: false,
						translationKey: 'MENU.CANDIDATES'
					}
				}
			]
		},
		{
			title: 'Organization',
			icon: 'globe-2-outline',
			data: {
				translated: false,
				translationKey: 'MENU.ORGANIZATION',
				withOrganizationShortcuts: true
			},
			children: [
				{
					title: 'Manage',
					icon: 'globe-2-outline',
					data: {
						translated: false,
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
						translated: false,
						permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
						translationKey: 'MENU.EQUIPMENT'
					}
				},
				{
					title: 'Inventory',
					icon: 'grid-outline',
					link: '/pages/organization/inventory',
					data: {
						translated: false,
						// permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
						translationKey: 'MENU.INVENTORY'
					}
				},
				{
					title: 'Tags',
					icon: 'pricetags-outline',
					link: '/pages/organization/tags',
					data: {
						translated: false,
						translationKey: 'MENU.TAGS'
						//   permissionKeys: [],
					}
				},
				{
					title: 'Clients',
					icon: 'book-open-outline',
					link: `/pages/organizations/`,
					data: {
						translated: false,
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/clients',
						translationKey: 'ORGANIZATIONS_PAGE.CLIENTS'
					}
				},
				{
					title: 'Vendors',
					icon: 'car-outline',
					link: `/pages/organizations/`,
					data: {
						translated: false,
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
						translated: false,
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
						translated: false,
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
						translated: false,
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
						translated: false,
						organizationShortcut: true,
						permissionKeys: [PermissionsEnum.ALL_ORG_EDIT],
						urlPrefix: `/pages/organizations/edit/`,
						urlPostfix: '/settings/teams',
						translationKey: 'ORGANIZATIONS_PAGE.EDIT.TEAMS'
					}
				},
				{
					title: 'Help Center',
					icon: 'question-mark-circle-outline',
					link: '/pages/organization/help-center',
					data: {
						translated: false,
						translationKey: 'MENU.HELP_CENTER'
					}
				}
			]
		},
		{
			title: 'Goals',
			icon: 'flag-outline',
			data: {
				translated: false,
				translationKey: 'MENU.GOALS'
			},
			children: [
				{
					title: 'Manage',
					link: '/pages/goals',
					icon: 'list-outline',
					data: {
						translated: false,
						translationKey: 'MENU.MANAGE'
					}
				},
				{
					title: 'Report',
					link: '/pages/goals/reports',
					icon: 'file-text-outline',
					data: {
						translated: false,
						translationKey: 'MENU.REPORTS'
					}
				},
				{
					title: 'Settings',
					link: '/pages/goals/settings',
					icon: 'settings-outline',
					data: {
						translated: false,
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
				translated: false,
				translationKey: 'MENU.REPORTS'
			},
			children: [
				{
					title: 'Time Reports',
					link: '/pages/reports/time',
					icon: 'clock-outline',
					data: {
						translated: false,
						translationKey: 'MENU.TIME_REPORTS'
					}
				},
				{
					title: 'Accounting Reports',
					link: '/pages/reports/accounting',
					icon: 'credit-card-outline',
					data: {
						translated: false,
						translationKey: 'MENU.ACCOUNTING_REPORTS'
					}
				}
			]
		},
		{
			title: 'Admin',
			group: true,
			data: {
				translated: false,
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
				translated: false,
				permissionKeys: [PermissionsEnum.ORG_USERS_VIEW],
				translationKey: 'MENU.USERS'
			}
		},
		{
			title: 'Organizations',
			icon: 'globe-outline',
			link: '/pages/organizations',
			data: {
				translated: false,
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
				translated: false,
				translationKey: 'MENU.INTEGRATIONS'
			}
		},
		{
			title: 'Settings',
			icon: 'settings-outline',
			data: {
				translated: false,
				translationKey: 'MENU.SETTINGS'
			},
			children: [
				{
					title: 'General',
					icon: 'edit-outline',
					link: '/pages/settings/general',
					data: {
						translated: false,
						translationKey: 'MENU.GENERAL'
					}
				},
				{
					title: 'Email History',
					icon: 'email-outline',
					link: '/pages/settings/email-history',
					data: {
						translated: false,
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
						translated: false,
						translationKey: 'MENU.EMAIL_TEMPLATES'
					}
				},
				{
					title: 'Import/Export',
					icon: 'flip-outline',
					data: {
						translated: false,
						translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT'
					},
					children: [
						{
							title: 'Export',
							icon: 'download-outline',
							link: '/pages/settings/import-export/export',
							data: {
								translated: false,
								translationKey: 'MENU.IMPORT_EXPORT.EXPORT'
							}
						},
						{
							title: 'Import',
							icon: 'upload-outline',
							link: '/pages/settings/import-export/import',
							data: {
								translated: false,
								translationKey: 'MENU.IMPORT_EXPORT.IMPORT'
							}
						}
					]
				},
				{
					title: 'Payment Gateways',
					icon: 'credit-card-outline',
					data: {
						translated: false,
						translationKey: 'MENU.PAYMENT_GATEWAYS'
					}
				},
				{
					title: 'Custom SMTP',
					icon: 'at-outline',
					data: {
						translated: false,
						translationKey: 'MENU.CUSTOM_SMTP'
					}
				},
				{
					title: 'Roles & Permissions',
					link: '/pages/settings/roles',
					icon: 'award-outline',
					data: {
						translated: false,
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
						translated: false,
						translationKey: 'MENU.DANGER_ZONE'
					}
				}
			]
		}
	];
	menu: NbMenuItem[] = this.MENU_ITEMS;

	constructor(
		private authService: AuthService,
		private translate: TranslateService,
		private store: Store,
		private selectorService: SelectorService,
		private router: Router
	) {}

	async ngOnInit() {
		await this.checkForAdmin();
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
			this.refreshMenuItem(
				item,
				withOrganizationShortcuts,
				forceTranslate
			);
		});
	}

	refreshMenuItem(item, withOrganizationShortcuts, forceTranslate) {
		if (!item.data.translated) {
			item.title = this.getTranslation(item.data.translationKey);
		} else if (forceTranslate) {
			item.title = this.getTranslation(item.data.translationKey);
		}

		if (item.data.permissionKeys) {
			const anyPermission = item.data.permissionKeys.reduce(
				(permission, key) => {
					return this.store.hasPermission(key) || permission;
				},
				false
			);
			item.hidden = !anyPermission;

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
				this.refreshMenuItem(
					childItem,
					withOrganizationShortcuts,
					forceTranslate
				);
			});
		}
	}

	async checkForAdmin() {
		this.isAdmin = await this.authService
			.hasRole([RolesEnum.ADMIN])
			.pipe(first())
			.pipe(takeUntil(this._ngDestroy$))
			.toPromise();
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

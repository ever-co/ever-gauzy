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
			home: true,
			data: {
				translated: false,
				translationKey: 'MENU.DASHBOARD'
			}
		},
		{
			title: 'Income',
			icon: 'plus-circle-outline',
			link: '/pages/income',
			data: {
				translated: false,
				translationKey: 'MENU.INCOME',
				permissionKeys: [PermissionsEnum.ORG_INCOMES_VIEW]
			}
		},
		{
			title: 'Expenses',
			icon: 'minus-circle-outline',
			link: '/pages/expenses',
			data: {
				translated: false,
				translationKey: 'MENU.EXPENSES',
				permissionKeys: [PermissionsEnum.ORG_EXPENSES_VIEW]
			}
		},
		{
			title: 'Proposals',
			icon: 'paper-plane-outline',
			link: '/pages/proposals',
			hidden: false,
			data: {
				translated: false,
				translationKey: 'MENU.PROPOSALS',
				permissionKeys: [PermissionsEnum.ORG_PROPOSALS_VIEW]
			}
		},
		{
			title: 'Time Off',
			icon: 'calendar-outline',
			link: '/pages/time-off',
			data: {
				translated: false,
				translationKey: 'MENU.TIME_OFF',
				permissionKeys: [PermissionsEnum.POLICY_VIEW]
			}
		},
		{
			title: 'Tags',
			icon: 'pricetags-outline',
			link: '/pages/tags',
			data: {
				translated: false,
				translationKey: 'MENU.TAGS'
				//   permissionKeys: [],
			}
		},
		{
			title: 'Tasks',
			icon: 'browser-outline',
			link: '/pages/tasks',
			data: {
				translated: false,
				translationKey: 'MENU.TASKS'
				//   permissionKeys: [],
			}
		},
		{
			title: 'Help',
			icon: 'question-mark-circle-outline',
			link: '/pages/help',
			data: {
				translated: false,
				translationKey: 'MENU.HELP'
			}
		},
		{
			title: 'About',
			icon: 'droplet-outline',
			link: '/pages/about',
			data: {
				translated: false,
				translationKey: 'MENU.ABOUT'
			}
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
			title: 'Employees',
			icon: 'people-outline',
			link: '/pages/employees',
			data: {
				translated: false,
				permissionKeys: [
					PermissionsEnum.ORG_EMPLOYEES_VIEW,
					PermissionsEnum.ORG_EXPENSES_EDIT
				],
				translationKey: 'MENU.EMPLOYEES'
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
			title: 'Equipment',
			icon: 'shopping-bag-outline',
			link: '/pages/equipment',
			data: {
				translated: false,
				permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
				translationKey: 'MENU.EQUIPMENT'
			}
		},
		{
			title: 'Equipment Sharing',
			icon: 'shopping-cart-outline',
			link: '/pages/equipment-sharing',
			data: {
				translated: false,
				permissionKeys: [PermissionsEnum.ALL_ORG_VIEW],
				translationKey: 'MENU.EQUIPMENT_SHARING'
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
					link: '/pages/settings/general',
					data: {
						translated: false,
						translationKey: 'MENU.GENERAL'
					}
				},
				{
					title: 'Roles & Permissions',
					link: '/pages/settings/roles',
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
					data: {
						translated: false,
						translationKey: 'MENU.DANGER_ZONE'
					}
				},
				{
					title: 'Import/Export',
					icon: 'arrow-circle-down-outline',
					link: '/pages/import-export',
					data: {
						translated: false,
						translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT'
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

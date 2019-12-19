import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { RolesEnum } from '@gauzy/models';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Organization } from 'apps/api/src/app/organization';
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
			title: this.getTranslation('MENU.DASHBOARD'),
			icon: 'home-outline',
			link: '/pages/dashboard',
			home: true
		},
		{
			title: this.getTranslation('MENU.INCOME'),
			icon: 'plus-circle-outline',
			link: '/pages/income'
		},
		{
			title: this.getTranslation('MENU.EXPENSES'),
			icon: 'minus-circle-outline',
			link: '/pages/expenses'
		},
		{
			title: this.getTranslation('MENU.PROPOSALS'),

			icon: 'paper-plane-outline',
			link: '/pages/proposals',
			hidden: false
		},
		{
			title: this.getTranslation('MENU.HELP'),
			icon: 'question-mark-circle-outline',
			link: '/pages/help'
		},
		{
			title: this.getTranslation('MENU.ABOUT'),
			icon: 'droplet-outline',
			link: '/pages/about'
		},
		{
			title: this.getTranslation('MENU.ADMIN'),
			group: true,
			data: {
				permission: 'admin'
			}
		},
		{
			title: this.getTranslation('MENU.EMPLOYEES'),
			icon: 'people-outline',
			link: '/pages/employees',
			data: {
				permission: 'admin'
			}
		},
		{
			title: this.getTranslation('MENU.USERS'),
			icon: 'people-outline',
			link: '/pages/users',
			data: {
				permission: 'admin'
			}
		},
		{
			title: this.getTranslation('ORGANIZATIONS_PAGE.PROJECTS'),
			icon: 'book-outline',
			link: `/pages/organizations/`,
			data: {
				permission: 'organization-selected',
				urlPrefix: `/pages/organizations/edit/`,
				urlPostfix: '/settings/projects'
			}
		},
		{
			title: this.getTranslation('ORGANIZATIONS_PAGE.DEPARTMENTS'),
			icon: 'briefcase-outline',
			link: `/pages/organizations/`,
			data: {
				permission: 'organization-selected',
				urlPrefix: `/pages/organizations/edit/`,
				urlPostfix: '/settings/departments'
			}
		},
		{
			title: this.getTranslation('ORGANIZATIONS_PAGE.CLIENTS'),
			icon: 'book-open-outline',
			link: `/pages/organizations/`,
			data: {
				permission: 'organization-selected',
				urlPrefix: `/pages/organizations/edit/`,
				urlPostfix: '/settings/clients'
			}
		},
		{
			title: this.getTranslation('ORGANIZATIONS_PAGE.POSITIONS'),
			icon: 'award-outline',
			link: `/pages/organizations/`,
			data: {
				permission: 'organization-selected',
				urlPrefix: `/pages/organizations/edit/`,
				urlPostfix: '/settings/positions'
			}
		},
		{
			title: this.getTranslation('ORGANIZATIONS_PAGE.VENDORS'),
			icon: 'car-outline',
			link: `/pages/organizations/`,
			data: {
				permission: 'organization-selected',
				urlPrefix: `/pages/organizations/edit/`,
				urlPostfix: '/settings/vendors'
			}
		},
		{
			title: this.getTranslation('MENU.ORGANIZATIONS'),
			icon: 'globe-outline',
			link: '/pages/organizations',
			data: {
				permission: 'admin'
			}
		},
		{
			title: this.getTranslation('MENU.SETTINGS'),
			icon: 'settings-outline',
			children: [
				{
					title: this.getTranslation('MENU.GENERAL'),
					link: '/pages/settings/general'
				}
			]
		}
	];

	menu: NbMenuItem[] = [];

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
						.showOrganizationShortcuts,
					false
				);
			});

		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((e) => {
				this.loadItems(
					this.selectorService.showSelectors(e['url'])
						.showOrganizationShortcuts,
					false
				);
			});
	}

	loadItems(withOrganizationShortcuts: boolean, translateTitle) {
		this.menu.forEach((item) => {
			this.refreshMenuItem(
				item,
				withOrganizationShortcuts,
				translateTitle
			);
		});
	}

	refreshMenuItem(item, withOrganizationShortcuts, translateTitle) {
		if (translateTitle) {
			item.title = this.getTranslation(item.title);
		}
		if (!item.data) {
			item.hidden = false;
		} else {
			if (item.data.permission === 'admin') {
				item.hidden = !this.isAdmin;
			} else if (item.data.permission === 'organization-selected') {
				item.hidden =
					!withOrganizationShortcuts || !this._selectedOrganization;
				if (!item.hidden) {
					item.link =
						item.data.urlPrefix +
						this._selectedOrganization.id +
						item.data.urlPostfix;
				}
			} else {
				item.hidden = false;
			}
		}

		if (item.children) {
			item.children.forEach((childItem) => {
				this.refreshMenuItem(
					childItem,
					withOrganizationShortcuts,
					translateTitle
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
		let result = '';
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.menu = this.MENU_ITEMS;
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

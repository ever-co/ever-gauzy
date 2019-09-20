import { Component } from '@angular/core';

import { AuthService } from '../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ngx-pages',
	styleUrls: ['pages.component.scss'],
	template: `
		<ngx-one-column-layout>
			<nb-menu [items]="menu"></nb-menu>
			<router-outlet></router-outlet>
		</ngx-one-column-layout>
	`
})
export class PagesComponent {
	menu: NbMenuItem[];

	constructor(
		private authService: AuthService,
		private translate: TranslateService
	) {
		this.loadItems();
		this._applyTranslationOnSmartTable();
	}

	loadItems() {
		this.menu = [
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
				title: this.getTranslation('MENU.HELP'),
				icon: 'question-mark-circle-outline',
				link: '/pages/help'
			},
			{
				title: this.getTranslation('MENU.ABOUT'),
				icon: 'droplet-outline',
				link: '/pages/about'
			}
		];

		this.checkForAdmin();
	}

	async checkForAdmin() {
		const isAdmin = await this.authService
			.hasRole([RolesEnum.ADMIN])
			.pipe(first())
			.toPromise();

		if (isAdmin) {
			this.menu = [
				...this.menu,
				{
					title: this.getTranslation('MENU.ADMIN'),
					group: true
				},
				{
					title: this.getTranslation('MENU.EMPLOYEES'),
					icon: 'people-outline',
					link: '/pages/employees'
				},
				{
					title: this.getTranslation('MENU.ORGANIZATIONS'),
					icon: 'globe-outline',
					link: '/pages/organizations'
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
		}
	}

	getTranslation(prefix: string) {
		let result = '';
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange.subscribe(() => {
			this.loadItems();
		});
	}
}

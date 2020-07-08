import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbMenuItem } from '@nebular/theme';

@Component({
	selector: 'ngx-import-export',
	templateUrl: './import-export.html'
})
export class ImportExportComponent implements OnInit, OnDestroy {
	constructor() {}

	MENU_ITEMS: NbMenuItem[] = [
		{
			title: 'All',
			icon: 'home-outline',
			link: '/pages/settings/import-export/all',
			//pathMatch: 'prefix',
			home: true,
			data: {
				translated: false,
				translationKey: 'All'
			}
		},

		{
			title: 'Tasks',
			icon: 'browser-outline',
			link: '/pages/settings/import-export/import',
			data: {
				translated: false,
				translationKey: 'MENU.TASKS'
			}
		}
	];

	ngOnInit() {}

	ngOnDestroy() {}
}

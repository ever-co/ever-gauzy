import { Component } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';

@Component({
	selector: 'ngx-plugin-layout',
	templateUrl: './plugin-layout.component.html',
	styleUrls: ['./plugin-layout.component.scss']
})
export class PluginLayoutComponent {
	public readonly tabs: NbRouteTab[] = [
		{
			title: 'Discover',
			route: '/settings/marketplace-plugins',
			icon: 'search-outline',
			responsive: true,
			activeLinkOptions: {
				exact: false
			}
		},
		{
			title: 'Installed',
			route: '/settings/plugins',
			icon: 'checkmark-circle-2-outline'
		}
	];
}

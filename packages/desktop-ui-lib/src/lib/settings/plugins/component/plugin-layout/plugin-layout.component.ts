import { Component } from '@angular/core';

@Component({
	selector: 'ngx-plugin-layout',
	templateUrl: './plugin-layout.component.html',
	styleUrls: ['./plugin-layout.component.scss']
})
export class PluginLayoutComponent {
	public readonly tabs = [
		{
			title: 'Discover',
			route: '/settings/marketplace-plugins',
			icon: 'search-outline',
			responsive: true
		},
		{
			title: 'Installed',
			route: '/settings/plugins',
			icon: 'checkmark-circle-2-outline'
		}
	];
}

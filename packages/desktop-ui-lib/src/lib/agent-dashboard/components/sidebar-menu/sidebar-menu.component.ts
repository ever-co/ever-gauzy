import { Component } from '@angular/core';
import { NbMenuItem } from '@nebular/theme';

@Component({
	selector: 'app-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss'],
	standalone: false
})
export class SidebarMenuComponent {
	menu: NbMenuItem[] = [
		{
			title: 'Logss',
			link: '/server-dashboard/logs', // Assuming this will be the route for logs
			icon: 'file-text-outline',
		},
		{
			title: 'Sync API Activity',
			link: '/server-dashboard/sync-activity', // Assuming this will be the route for sync activity
			icon: 'sync-outline',
		},
	];
}

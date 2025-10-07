import { Component } from '@angular/core';

@Component({
	selector: 'ngx-activepieces',
	template: `
		<nb-card>
			<nb-card-body>
				<nb-route-tabset [tabs]="tabs" fullWidth></nb-route-tabset>
				<router-outlet></router-outlet>
			</nb-card-body>
		</nb-card>
	`,
	standalone: false
})
export class ActivepiecesComponent {
	tabs: any[] = [
		{
			title: 'Connections',
			route: './connections',
			responsive: true
		},
		{
			title: 'MCP Servers',
			route: './mcp-servers',
			responsive: true
		},
		{
			title: 'Settings',
			route: './settings',
			responsive: true
		}
	];
}

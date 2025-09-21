import { Component } from '@angular/core';

@Component({
	selector: 'ngx-agent-dashboard',
	templateUrl: './server-dashboard.component.html',
	styleUrls: ['./server-dashboard.component.scss'],
	standalone: false
})
export class AgentDashboardComponent {
	menu = [
		{ title: 'Dashboard', icon: 'home-outline', link: '/', home: true },
		{ title: 'Reports', icon: 'bar-chart-2-outline', link: '/reports' },
		{ title: 'Logs', icon: 'activity-outline', link: '/logs' },
	];

	tracking = true;
	range = 'Today · Fri, Sep 19';
	workspace = 'Personal';

	kpis = [
		{ label: 'Worked', value: '7h 42m' },
		{ label: 'Active', value: '6h 10m' },
		{ label: 'Idle', value: '1h 32m' },
		{ label: 'Focus score', value: '82' },
	];
}

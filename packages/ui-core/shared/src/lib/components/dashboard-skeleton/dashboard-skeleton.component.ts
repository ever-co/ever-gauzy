import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-dashboard-skeleton',
	templateUrl: './dashboard-skeleton.component.html',
	styleUrls: ['./dashboard-skeleton.component.scss'],
	standalone: false
})
export class DashboardSkeletonComponent {
	@Input() type: 'widget' | 'window' | 'card' = 'widget';
	@Input() windowType?: 'recent-activities' | 'manual-time' | 'tasks' | 'projects' | 'apps-urls' | 'members';
}

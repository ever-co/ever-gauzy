import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
	selector: 'ga-dashboard-skeleton',
	templateUrl: './dashboard-skeleton.component.html',
	styleUrls: ['./dashboard-skeleton.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		role: 'status',
		'aria-live': 'polite',
		'aria-busy': 'true',
		'aria-label': 'Loading dashboard'
	}
})
export class DashboardSkeletonComponent {
	@Input() type: 'widget' | 'window' | 'card' = 'widget';
	@Input() windowType?: 'recent-activities' | 'manual-time' | 'tasks' | 'projects' | 'apps-urls' | 'members';

	trackByIndex(index: number): number {
		return index;
	}
}

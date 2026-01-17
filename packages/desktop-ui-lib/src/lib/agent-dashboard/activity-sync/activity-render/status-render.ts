
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
	selector: 'app-status-badge',
	templateUrl: './status-render.html',
	styleUrls: ['./status-render.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class StatusBadgeComponent {

	@Input() value: string | number;
	@Input() rowData: any;

	get badgeStatus(): string {
		const statusValue = String(this.value || '').toLowerCase();
		switch (statusValue) {
			case 'active':
			case 'succeeded':
			case 'synced':
				return 'success';
			case 'pending':
			case 'waiting':
				return 'warning';
			case 'inactive':
			case 'failed':
				return 'danger';
			case 'running':
			case 'process':
				return 'info';
			default:
				return 'basic';
		}
	}
}

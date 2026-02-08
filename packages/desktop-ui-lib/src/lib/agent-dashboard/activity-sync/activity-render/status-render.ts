
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { StatusMapper } from '../../../shared/utils/queue-status-mapper.util';

@Component({
    selector: 'app-status-badge',
    templateUrl: './status-render.html',
    styleUrls: ['./status-render.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
	@Input() value: string;
	@Input() rowData: any;

	get badgeStatus(): string {
		return StatusMapper.getBadgeStatus(this.value || '')
	}
}

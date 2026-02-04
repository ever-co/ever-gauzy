import { Component, Input } from '@angular/core';
import { NbDialogRef, NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { QueueItem } from '../../models/logs.models';
import { StatusMapper } from '../../../shared/utils/queue-status-mapper.util';


@Component({
    selector: 'app-activity-sync-detail-modal',
    templateUrl: './activity-sync-detail-modal.component.html',
    styleUrls: ['./activity-sync-detail-modal.component.scss'],
    imports: [NbCardModule, NbButtonModule, NbIconModule]
})
export class ActivitySyncDetailModalComponent {
	@Input() data: QueueItem;

	constructor(
		protected dialogRef: NbDialogRef<ActivitySyncDetailModalComponent>,
	) { }

	close() {
		this.dialogRef.close();
	}

	getFormattedData(): string {
		if (!this.data?.data) {
			return 'N/A';
		}

		if (typeof this.data.data === 'string') {
			try {
				return JSON.stringify(JSON.parse(this.data.data), null, 2);
			} catch (err) {
				return this.data.data;
			}
		}

		return JSON.stringify(this.data.data, null, 2);
	}

	getFormattedDate(date: Date | string | number): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	getStatusClass(status: string): string {
		return StatusMapper.getBadgeStatus(status);
	}
}

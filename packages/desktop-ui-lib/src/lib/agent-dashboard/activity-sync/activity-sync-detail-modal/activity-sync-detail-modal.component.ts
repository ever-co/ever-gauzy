import { Component, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { QueueItem } from '../../models/logs.models';

@Component({
	selector: 'app-activity-sync-detail-modal',
	templateUrl: './activity-sync-detail-modal.component.html',
	styleUrls: ['./activity-sync-detail-modal.component.scss'],
	standalone: false
})
export class ActivitySyncDetailModalComponent {
	@Input() data: QueueItem;

	constructor(protected dialogRef: NbDialogRef<ActivitySyncDetailModalComponent>) {}

	close() {
		this.dialogRef.close();
	}

	getFormattedData(data: any): string {
		if (!data) {
			return 'N/A';
		}


		if (typeof this.data.data === 'string') {
			try {
				return JSON.stringify(JSON.parse(this.data.data), null, 2);
			} catch(err) {
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
		const statusValue = String(status || '').toLowerCase();
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

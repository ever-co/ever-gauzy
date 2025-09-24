import { Pipe, PipeTransform } from '@angular/core';
import { QueueItem, SyncStatus } from '../models/logs.models';

@Pipe({ name: 'filterStatus' })
export class FilterStatusPipe implements PipeTransform {
	transform(items: QueueItem[] | null, status: SyncStatus): QueueItem[] {
		const typeStatus = {
			PENDING: 'waiting',
			FAILED: 'failed',
			SYNCED: 'succeeded'
		}
		if (!items) return [];
		return items.filter(i => i.status === typeStatus[status]);
	}
}

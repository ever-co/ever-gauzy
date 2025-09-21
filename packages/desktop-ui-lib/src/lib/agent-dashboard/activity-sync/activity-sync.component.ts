import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { QueueItem, SyncHealth } from '../models/logs.models';
import { LogService } from '../services/logs.service';

@Component({
	selector: 'app-sync-page',
	templateUrl: './activity-sync.component.html',
	styleUrls: ['./activity-sync.component.scss'],
	standalone: false
})
export class SyncPageComponent {
	items$: Observable<QueueItem[]> = this.svc.queueStream$;
	health$: Observable<SyncHealth> = this.svc.healthStream$;
	tab: 'PENDING' | 'FAILED' | 'SYNCED' = 'PENDING';

	constructor(private svc: LogService) { }

	retry(it: QueueItem) { this.svc.retryQueueItem(it.id); }
	clearSynced() { this.svc.clearSynced(); }
}

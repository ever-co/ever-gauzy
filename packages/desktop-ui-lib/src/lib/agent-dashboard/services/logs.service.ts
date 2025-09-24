import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LogEntry, QueueItem, SyncHealth } from '../models/logs.models';
import { ElectronService } from '../../electron/services';

@Injectable({ providedIn: 'root' })
export class LogService {
	private logs$ = new BehaviorSubject<LogEntry[]>([]);
	private queue$ = new BehaviorSubject<QueueItem[]>([]);
	private health$ = new BehaviorSubject<SyncHealth>({ queueLength: 5, lastSuccessAt: new Date().toISOString(), apiReachable: true });

	logsStream$ = this.logs$.asObservable();
	queueStream$ = this.queue$.asObservable();
	healthStream$ = this.health$.asObservable();

	constructor(
		private electronService: ElectronService
	) {
		this.electronService.ipcRenderer.on('DASHBOARD_EVENT', this.dashboardEventHandle.bind(this));
		this.getHistorySync();
	}

	dashboardEventHandle(_, arg: { type: string, data: Record<string, unknown> }) {
		switch (arg.type) {
			case 'log_state':
				this.handleLogStream(arg.data);
				break;
			case 'api_sync_update':
				this.updateApiLogs(arg.data);
				break;
			default:
				break;
		}
	}

	handleLogStream(data: any) {
		const newLog: LogEntry = {
			id: `log_${Date.now()}`,
			ts: new Date(data.dateTime).toISOString(),
			level: data.type.toUpperCase(),
			msg: data.msg
		};
		const arr = [...this.logs$.value, newLog];
		if (arr.length > 200) {
			arr.shift();
		}
		this.logs$.next(arr);
	}

	async updateApiLogs(data:any) {
		console.log(data);
	}

	retryQueueItem(id: string) {
		const arr = [...this.queue$.value];
		const it = arr.find(x => x.id === id);
		if (it) {
			it.retries += 1;
			if (it.retries >= 2) { it.status = 'SYNCED'; this.health$.next({ ...this.health$.value, lastSuccessAt: new Date().toISOString() }); }
			this.queue$.next(arr);
		}
	}

	clearSynced() {
		this.queue$.next(this.queue$.value.filter(x => x.status !== 'SYNCED'));
	}

	private async getHistorySync() {
		const dataSync = await this.electronService.ipcRenderer.invoke('SYNC_API_AUDIT');
		console.log('datasync', dataSync);
		this.queue$.next(dataSync);
	}

	private mockQueue(): QueueItem[] {
		const now = Date.now();
		return Array.from({ length: 10 }, (_, i) => ({ id: 'q_' + i, createdAt: new Date(now - i * 5 * 60000).toISOString(), type: i % 2 === 0 ? 'screenshot' : 'window', sizeBytes: i % 2 === 0 ? 220000 + i * 10000 : undefined, retries: i % 3, status: i % 4 === 0 ? 'FAILED' : i % 5 === 0 ? 'SYNCED' : 'PENDING', errorMessage: i % 4 === 0 ? 'Network timeout' : undefined }));
	}
}

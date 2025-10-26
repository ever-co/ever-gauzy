import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LogEntry, QueueItem, SyncHealth } from '../models/logs.models';
import { ElectronService } from '../../electron/services';

interface IUpdateApiLogsArg {
	queue_id: string;
	queue?: string;
	status?: string;
	attempts?: number;
	priority?: number;
	data?: Record<string, unknown> | string;
	created_at?: Date;
	action: 'update' | 'add';
	last_error: string;
}

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
		this.getHistorySync('succeeded');
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

	async updateApiLogs(data: IUpdateApiLogsArg) {
		if (data.action === 'add') {
			const arr = [...this.queue$.value];
			const existQueueIdx = this.queue$.value.findIndex((q) => q.queue_id === data.queue_id);
			if (existQueueIdx > -1) {
				const currentQueue = { ...arr[existQueueIdx] };
				arr.splice(existQueueIdx, 1);
				currentQueue.attempts += 1;
				arr.unshift(currentQueue);
				this.queue$.next(arr);
			} else {
				const arr = [data, ...this.queue$.value];
				this.queue$.next(arr);
			}
			return;
		}

		if (data.action === 'update') {
			const arr = [...this.queue$.value];
			const existQueueIdx = this.queue$.value.findIndex((q) => q.queue_id === data.queue_id);
			if (existQueueIdx > -1) {
				const currentQueue = { ...arr[existQueueIdx] };
				arr.splice(existQueueIdx, 1);
				currentQueue.status = data.status;
				currentQueue.last_error = data.last_error;
				arr.unshift(currentQueue);
			}
			this.queue$.next(arr);
		}
	}

	clearSynced() {
		this.queue$.next(this.queue$.value.filter(x => x.status !== 'SYNCED'));
	}

	async getHistorySync(status: string) {
		const dataSync = await this.electronService.ipcRenderer.invoke('SYNC_API_AUDIT', {
			data: {
				page: 0,
				limit: 100,
				status
			}
		});
		this.queue$.next(dataSync);
	}
}

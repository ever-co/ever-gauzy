import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LogEntry, QueueItem, SyncHealth } from '../models/logs.models';
import { LogService } from './logs.service';
import { TasksService } from './tasks-service';
import { ElectronService } from '../../electron/services';

@Injectable({ providedIn: 'root' })
export class IpcService {
	constructor(
		private electronService: ElectronService,
		private logService: LogService,
		private taskService: TasksService,
		private _ngZone: NgZone
	) { }

	dashboardEventHandle(_: any, arg: { type: string, data: any }) {
		switch (arg.type) {
			case 'log_state':
				this.logService.handleLogStream(arg.data);
				break;
			case 'api_sync_update':
				this.logService.updateApiLogs(arg.data);
				break;
			case 'init_dashboard':
				this.initDashboard();
				break;
			default:
				break;
		}
	}

	ipcListen() {
		this.electronService.ipcRenderer.on('DASHBOARD_EVENT', this.dashboardEventHandle.bind(this));
	}

	ipcRemoveListener() {
		this.electronService.ipcRenderer.removeListener('DASHBOARD_EVENT', this.dashboardEventHandle.bind(this));
	}

	async initDashboard() {
		this._ngZone.run(async () => {
			const parallelizedTasks: Promise<void>[] = [
				this.taskService.loadTaskStatus(),
			];
			await Promise.allSettled(parallelizedTasks);
		})
	}
}

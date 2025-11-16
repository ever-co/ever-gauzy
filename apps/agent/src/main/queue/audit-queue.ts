import * as path from 'path';
import {
	AuditQueueService
} from '@gauzy/desktop-lib';
export type AuditStatus = 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled';
import AppWindow from '../window-manager';

interface IQueueUpdatePayload {
	queue_id: string;
	queue?: string;
	status?: string;
	attempts?: number;
	priority?: number;
	data?: Record<string, unknown> | string;
	created_at?: Date;
}

export class QueueAudit {
	static instance: QueueAudit;
	private auditQueueService: AuditQueueService;
	private appWindow: AppWindow;
	constructor() {
		this.auditQueueService = new AuditQueueService();
		this.appWindow = AppWindow.getInstance(path.join(__dirname, '../..'));
	}

	dashboardEventUpdate(action: 'update' | 'add', queue: IQueueUpdatePayload) {
		if (this.appWindow.logWindow && !this.appWindow.logWindow?.webContents?.isDestroyed()) {
			this.appWindow.logWindow.webContents?.send('DASHBOARD_EVENT', {
				type: 'api_sync_update',
				data: {
					...queue,
					action
				}
			});
		}
	}

	static getInstance(): QueueAudit {
		if (!QueueAudit.instance) {
			QueueAudit.instance = new QueueAudit();
		}
		return QueueAudit.instance;
	}

	queued(id: string, queue: string, data: any, priority?: number) {
		const newQueue = {
			queue_id: id,
			queue,
			status: 'waiting',
			attempts: 1,
			priority: priority,
			data: JSON.stringify(data),
			created_at: new Date()
		};
		this.dashboardEventUpdate(
			'add',
			newQueue
		);
		return this.auditQueueService.save(newQueue);
	}

	running(id: string, data: any) {
		this.dashboardEventUpdate('update', {
			queue_id: id,
			status: 'running'
		});
		return this.auditQueueService.update({
			queue_id: id,
			status: 'running',
			started_at: new Date()
		});
	}

	succeeded(id: string) {
		this.dashboardEventUpdate('update', {
			queue_id: id,
			status: 'succeeded'
		});
		return this.auditQueueService.update({
			queue_id: id,
			status: 'succeeded',
			finished_at: new Date(),
			last_error: null
		});
	}

	failed(id: string, err: any) {
		this.dashboardEventUpdate('update', {
			queue_id: id,
			status: 'failed'
		});
		return this.auditQueueService.update({
			queue_id: id,
			status: 'failed',
			finished_at: new Date(),
			last_error: `${JSON.stringify(err.message)}`
		});
	}

	cancelled(id: string) {
		return this.auditQueueService.update({
			queue_id: id,
			status: 'cancelled',
			finished_at: new Date()
		});
	}

	list(opts: { status?: AuditStatus; queue?: string; limit?: number; page?: number } = {}) {
		const { status, limit = 100, page = 0 } = opts;
		return this.auditQueueService.list(page, limit, status);
	}
}

import {
	AuditQueueService
} from '@gauzy/desktop-lib';
export type AuditStatus = 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export class QueueAudit {
	static instance: QueueAudit;
	private auditQueueService: AuditQueueService;
	constructor() {
		this.auditQueueService = new AuditQueueService();
	}

	static getInstance(): QueueAudit {
		if (!QueueAudit.instance) {
			QueueAudit.instance = new QueueAudit();
		}
		return QueueAudit.instance;
	}

	queued(id: string, queue: string, data: any, priority?: number) {
		return this.auditQueueService.save({
			queue_id: id,
			queue,
			status: 'waiting',
			attempts: 1,
			priority: priority,
			data: data,
			created_at: new Date()
		});
	}

	running(id: string) {
		return this.auditQueueService.update({
			queue_id: id,
			status: 'running',
			started_at: new Date()
		});
	}

	succeeded(id: string) {
		return this.auditQueueService.update({
			queue_id: id,
			status: 'succeeded',
			finished_at: new Date(),
			last_error: null
		});
	}

	failed(id: string, err: any) {
		return this.auditQueueService.update({
			queue_id: id,
			status: 'failed',
			finished_at: new Date(),
			last_error: JSON.stringify(err)
		});
	}

	cancelled(id: string) {
		return this.auditQueueService.update({
			queue_id: id,
			status: 'cancelled',
			finished_at: new Date(),

		});
	}

	list(opts: { status?: AuditStatus; queue?: string; limit?: number; offset?: number } = {}) {
		const { status, queue, limit = 50, offset = 0 } = opts;
		const where: string[] = []; const p: any = { limit, offset };
		if (status) { where.push('status=@status'); p.status = status; }
		if (queue) { where.push('queue=@queue'); p.queue = queue; }
		return this.auditQueueService.list();
	}
}

import { AppError } from '../../error-handler';
import { IAuditQueueService } from '../../interfaces';
import { AuditQueueDAO } from '../dao';
import { AuditQueueTO } from '../dto';
import { AuditQueue } from '../models';

export class AuditQueueService implements IAuditQueueService<AuditQueueTO> {
	private _auditQueueDAO: AuditQueueDAO;

	constructor() {
		this._auditQueueDAO = new AuditQueueDAO();
	}

	public async save(queue: AuditQueueTO): Promise<AuditQueueTO | null> {
		try {
			if (!queue) {
				console.error('WARN[AUDIT_QUEUE_SERVICE]: No audit queue data, cannot save');
				return null;
			}
			return await this._auditQueueDAO.saveAndReturn(queue);
		} catch (error) {
			throw new AppError('AUDIT_QUEUE_SERVICE', error);
		}
	}

	public async update(queue: Partial<AuditQueueTO>): Promise<AuditQueueTO | null> {
		try {
			if (!queue.queue_id) {
				console.error('WARN[AUDIT_QUEUE_SERVICE]: No audit queue data, cannot update');
				return null;
			}
			return this._auditQueueDAO.updatePartial(queue.queue_id, queue);
		} catch (error) {
			throw new AppError('AUDIT_QUEUE_SERVICE', error);
		}
	}

	public async retrieve(id: string): Promise<AuditQueueTO> {
		try {
			const queueDao = await this._auditQueueDAO.current(id);
			if (queueDao) {
				const queue = new AuditQueue(queueDao);
				return queue;
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async remove(activity: Partial<AuditQueueTO>): Promise<void> {
		try {
			await this._auditQueueDAO.delete(activity);
		} catch (error) {
			throw new AppError('AUDIT_QUEUE_SERVICE', error);
		}
	}

	public async list(page: number, limit: number, status: string): Promise<AuditQueueTO[]> {
		return this._auditQueueDAO.pageAndFilter(page, limit, status);
	}
}

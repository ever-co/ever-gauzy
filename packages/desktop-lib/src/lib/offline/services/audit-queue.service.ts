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

	public async save(queue: AuditQueueTO): Promise<void> {
		try {
			if (!queue) {
				return console.error('WARN[AUDIT_QUUE_SERVICE]: No audit queue data, cannot save');
			}
			await this._auditQueueDAO.save(queue);
		} catch (error) {
			throw new AppError('AUDIT_QUUE_SERVICE', error);
		}
	}

	public async update(queue: Partial<AuditQueueTO>): Promise<void> {
		try {
			if (!queue.queue_id) {
				return console.error('WARN[AUDIT_QUUE_SERVICE]: No audit queue data, cannot update');
			}
			await this._auditQueueDAO.update(queue.queue_id, queue);
		} catch (error) {
			throw new AppError('AUDIT_QUUE_SERVICE', error);
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
			throw new AppError('AUDIT_QUUE_SERVICE', error);
		}
	}

	public async list(): Promise<AuditQueueTO[]> {
		return this._auditQueueDAO.findAll()
	}
}

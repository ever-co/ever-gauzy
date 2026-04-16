import { IAuditLogService, IPaginationResult, IPagination } from "../../interfaces";
import { AuditLogDAO } from "../dao";
import { AuditLogTO } from "../dto";
import { AppError } from '../../error-handler';
import { AuditLog } from "../models";

export class AuditLogService implements IAuditLogService<AuditLogTO> {
	private _auditLogDao: AuditLogDAO;

	constructor() {
		this._auditLogDao = new AuditLogDAO();
	}

	public async save(auditLog: AuditLog): Promise<void> {
		if (!auditLog) {
			return console.error('WARN[AUDIT_LOG_SERVICE]: No audit log data, cannot save');
		}

		try {
			await this._auditLogDao.save(auditLog.toObject());
		} catch (error) {
			throw new AppError('AUDIT_LOG_SERVICE', error);
		}
	}

	public async saveAndReturn(auditLog: AuditLog): Promise<AuditLogTO> {
		if (!auditLog) {
			console.error('WARN[AUDIT_LOG_SERVICE]: No audit log data, cannot save');
			return null;
		}

		try {
			const result = await this._auditLogDao.saveAndReturn(auditLog.toObject());
			return result;
		} catch (error) {
			throw new AppError('AUDIT_LOG_SERVICE', error);
		}
	}

	public async update(auditLog: Partial<AuditLog>): Promise<void> {
		if (!auditLog.id) {
			return console.error('WARN[AUDIT_LOG_SERVICE]: No audit log data, cannot update');
		}

		try {
			await this._auditLogDao.update(auditLog.id, auditLog.toObject());
		} catch (error) {
			throw new AppError('AUDIT_LOG_SERVICE', error);
		}
	}

	public async remove(auditLog: Partial<AuditLog>): Promise<void> {
		if (!auditLog.createdAt) {
			return console.error('WARN[AUDIT_LOG_SERVICE]: No audit log createdAt, cannot delete');
		}

		try {
			await this._auditLogDao.delete(auditLog.toObject());
		} catch (error) {
			throw new AppError('AUDIT_LOG_SERVICE', error);
		}
	}

	public async findById(id: number): Promise<AuditLogTO> {
		if (!id) {
			console.error('WARN[AUDIT_LOG_SERVICE]: No audit log id, cannot find');
			return null;
		}

		try {
			const result = await this._auditLogDao.findOneById(id);
			return result;
		} catch (error) {
			throw new AppError('AUDIT_LOG_SERVICE', error);
		}
	}

	public async findAuditLogs(log: IPagination<AuditLogTO>): Promise<IPaginationResult<AuditLogTO>> {
		try {
			const total = await this._auditLogDao.count(log.filter || {});
			const data = await this._auditLogDao.findByFilter(log);
			return {
				total,
				data
			};
		} catch (error) {
			console.error('ERROR[AUDIT_LOG_SERVICE]: Failed to find audit logs', error);
			return {
				total: 0,
				data: []
			};
		}

	}
}

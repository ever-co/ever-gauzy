import { AuditLogService, AuditLogTO, AuditLog } from '../offline';
import {
	TLogLevel,
	TServiceName,
} from '@gauzy/contracts';
import { IPaginationResult } from '../interfaces';
import { sendToChildWindow } from '@gauzy/desktop-window';

export class AuditLogHandler {
	private static instance: AuditLogHandler;
	private _auditLogService: AuditLogService;

	private constructor() {
		this._auditLogService = new AuditLogService();
	}

	public static getInstance(): AuditLogHandler {
		if (!AuditLogHandler.instance) {
			AuditLogHandler.instance = new AuditLogHandler();
		}
		return AuditLogHandler.instance;
	}

	async logAudit(level: TLogLevel, service: TServiceName, message: string): Promise<void> {
		const auditEntry: AuditLogTO = {
			createdAt: new Date(),
			logLevel: level,
			serviceName: service,
			message
		}
		this.saveLog(auditEntry);
	}

	async saveLog(entry: AuditLogTO): Promise<void> {
		try {
			const newLogEntry = await this._auditLogService.saveAndReturn(new AuditLog(entry));
			sendToChildWindow('AUDIT_LOG_ENTRY', newLogEntry);
		} catch (error) {
			console.error('Failed to save audit log entry:', error);
		}
	}

	async timerAuditInfo(message: string): Promise<void> {
		await this.logAudit('info', 'timer', message);
	}

	async timerAuditError(message: string): Promise<void> {
		await this.logAudit('error', 'timer', message);
	}

	async getAuditLogs(level: TLogLevel, service: TServiceName, page: number, limit: number): Promise<IPaginationResult<AuditLogTO>> {
		return this._auditLogService.findAuditLogs({
			limit,
			page,
			filter: {
				...(service !== 'all' ? { serviceName: service } : {}),
				...(level !== 'all' ? { logLevel: level } : {}),
			}
		});
	}
}

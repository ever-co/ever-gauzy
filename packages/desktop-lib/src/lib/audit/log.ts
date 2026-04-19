import { AuditLogService, AuditLogTO, SyncLogTO, AuditLog, SyncDataLogService } from "../offline";
import { SyncDataLog } from "../offline/models/sync-data.model";

export type LogLevel = 'info' | 'warn' | 'error';
export type ServiceName = 'timer' | 'screenshot' | 'timeslot';
export type SyncStatus = 'pending' | 'success' | 'failure';
export class AuditLogHandler {
	private static instance: AuditLogHandler;
	private _auditLogService: AuditLogService;
	private _syncLogService: SyncDataLogService;

	private constructor() {
		this._auditLogService = new AuditLogService();
		this._syncLogService = new SyncDataLogService();
	}

	public static getInstance(): AuditLogHandler {
		if (!AuditLogHandler.instance) {
			AuditLogHandler.instance = new AuditLogHandler();
		}
		return AuditLogHandler.instance;
	}

	async logAudit(level: LogLevel, service: ServiceName, message: string, syncLogId?: number): Promise<void> {
		const auditEntry: AuditLogTO = {
			createdAt: new Date(),
			logLevel: level,
			syncLogId: syncLogId || null, // Optional link to a sync item if it exists
			message
		}

		await this._auditLogService.save(new AuditLog(auditEntry));
	}

	async logSync(
		payload: string,
		key: string,
		status: SyncStatus = 'pending', // Defaults to pending
		response?: string,
		errorMessage?: string
	): Promise<SyncLogTO | null> {

		const syncLogEntry: SyncLogTO = {
			payload,
			key,
			status,
			response: response || null,
			errorMessage: errorMessage || null,
			createdAt: new Date()
		}

		return await this._syncLogService.saveAndReturn(new SyncDataLog(syncLogEntry));
	}


}

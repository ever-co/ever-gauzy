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

	/** Timestamp of the last successful purge — skip DB call if interval hasn't elapsed. */
	private _lastPurgedAt: Date | null = null;
	private _purgeInProgress = false;

	/** How often to check whether a purge is due (15 min). */
	private static readonly PURGE_INTERVAL_MS = 15 * 60 * 1000;

	/** Keep logs for this many days. */
	private static readonly RETENTION_DAYS = 8;

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
		await this.saveLog(auditEntry);
		this.purgeOldLogs();
	}

	async saveLog(entry: AuditLogTO): Promise<void> {
		try {
			const newLogEntry = await this._auditLogService.saveAndReturn(new AuditLog(entry));
			sendToChildWindow('AUDIT_LOG_ENTRY', newLogEntry);
		} catch (error) {
			console.error('Failed to save audit log entry:', error);
		}
	}

	/**
	 * Delete logs older than RETENTION_DAYS.
	 * Runs at most once per PURGE_INTERVAL_MS — the cached `_lastPurgedAt`
	 * timestamp is checked first so the DB is never touched unnecessarily.
	 * Fire-and-forget: errors are logged but never propagated.
	 */
	private purgeOldLogs(): void {
		const now = new Date();

		// Skip if we purged recently
		if (
			this._purgeInProgress || (
				this._lastPurgedAt &&
				now.getTime() - this._lastPurgedAt.getTime() < AuditLogHandler.PURGE_INTERVAL_MS
			)
		) {
			return;
		}

		const cutoff = new Date(now.getTime() - AuditLogHandler.RETENTION_DAYS * 24 * 60 * 60 * 1000);
		this._purgeInProgress = true;
		this._lastPurgedAt = now;
		this._auditLogService
			.remove({ createdAt: cutoff })
			.catch((err) => {
				console.error('[AuditLog] Failed to purge old logs:', err);
			}).finally(() => {
				this._purgeInProgress = false;
			});
		;
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

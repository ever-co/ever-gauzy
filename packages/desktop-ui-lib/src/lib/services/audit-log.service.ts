import { Injectable, inject } from '@angular/core';
import { ElectronService } from '../electron/services';
import {
	ISyncRequest,
	ILogRequest
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class AuditLogService {
	private readonly electronService = inject(ElectronService);

	private async syncLog(request: ISyncRequest): Promise<void> {
		return this.electronService.invoke('LOG_SYNC_TASK', request);
	}

	private async auditLog(request: ILogRequest): Promise<void> {
		return this.electronService.invoke('WRITE_AUDIT_LOG', request);
	}

	public timerAuditLogInfo(message: string) {
		return this.auditLog({
			message,
			logLevel: 'info',
			serviceName: 'timer'
		});
	}

	public timerAuditLogWarn(message: string) {
		return this.auditLog({
			message,
			logLevel: 'warn',
			serviceName: 'timer'
		});
	}

	public timerAuditLogError(message: string) {
		return this.auditLog({
			message,
			logLevel: 'error',
			serviceName: 'timer'
		});
	}

	public timeSlotLogInfo(message: string) {
		return this.auditLog({
			message,
			logLevel: 'info',
			serviceName: 'timeslot'
		});
	}

	public timeSlotLogWarn(message: string) {
		return this.auditLog({
			message,
			logLevel: 'warn',
			serviceName: 'timeslot'
		});
	}

	public timeSlotLogError(message: string) {
		return this.auditLog({
			message,
			logLevel: 'error',
			serviceName: 'timeslot'
		});
	}

	public screenshotLogInfo(message: string) {
		return this.auditLog({
			message,
			logLevel: 'info',
			serviceName: 'screenshot'
		});
	}

	public screenshotLogWarn(message: string) {
		return this.auditLog({
			message,
			logLevel: 'warn',
			serviceName: 'screenshot'
		});
	}

	public screenshotLogError(message: string) {
		return this.auditLog({
			message,
			logLevel: 'error',
			serviceName: 'screenshot'
		});
	}

	public syncLogSucess(payload: string, key: string, response?: string) {
		return this.syncLog({
			payload,
			status: 'success',
			errorMessage: '',
			key,
			response
		});
	}

	public getAuditLogs(level: string, service: string, page: number, limit: number): Promise<any> {
		return this.electronService.invoke('GET_AUDIT_LOGS', {
			level,
			service,
			page,
			limit
		});
	}
}

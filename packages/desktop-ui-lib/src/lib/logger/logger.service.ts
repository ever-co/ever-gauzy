import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuditLogService } from '../services';
import { ILogItems } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';

@Injectable({ providedIn: 'root' })
export class LoggerService {
	private readonly _electronService = inject(ElectronService);
	constructor(
		private readonly _auditLogService: AuditLogService
	) {
		this._electronService.ipcRenderer.on('AUDIT_LOG_ENTRY', (_, logEntry: ILogItems) => {
			this.logs$.next([logEntry, ...this.logs$.getValue()]);
		});
	}

	private readonly logs$ = new BehaviorSubject<ILogItems[]>([]);

	readonly logsStream$: Observable<ILogItems[]> = this.logs$.asObservable();


	private async getLogs(level: string, service: string, page: number, limit: number): Promise<ILogItems[]> {
		const logsResult = await this._auditLogService.getAuditLogs(level, service, page, limit);
		const logsSorted = logsResult.data.sort((a: ILogItems, b: ILogItems) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return logsSorted;
	}

	public async nextPage(level: string, service: string, page: number, limit: number): Promise<ILogItems[]> {
		const logsResult = await this.getLogs(level, service, page, limit);
		// Older entries (higher page numbers) must be prepended so the list stays
		// chronological: newest at the top, oldest at the bottom.
		this.logs$.next([...this.logs$.getValue(), ...logsResult]);
		return logsResult;
	}

	public async refreshLogs(level: string, service: string, page: number, limit: number): Promise<ILogItems[]> {
		const logsResult = await this.getLogs(level, service, page, limit);
		this.logs$.next(logsResult);
		return logsResult;
	}

	public async exportAuditLogs() {
		await this._electronService.ipcRenderer.invoke('EXPORT_AUDIT_LOGS');
	}
}

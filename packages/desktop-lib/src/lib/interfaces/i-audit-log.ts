import { AuditLog } from "../offline/models";
import { AuditLogTO } from "../offline/dto";

/**
	* Interface for the Audit Log Service
	* This service is responsible for managing audit log data, including saving, retrieving, and updating audit log entries.
	* @template T The type of audit log data being managed
 */
export interface IAuditLogService<T> {
	findAuditLogs(log: Partial<T>): Promise<AuditLogTO[]>;
	save(log: T): Promise<void>;
	saveAndReturn(log: T): Promise<AuditLogTO>;
	update(log: Partial<T>): Promise<void>;
	remove(log: T): Promise<void>;
	findById(id: number): Promise<AuditLogTO | null>;
}

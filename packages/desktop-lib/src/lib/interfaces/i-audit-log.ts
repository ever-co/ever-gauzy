import { AuditLogTO } from "../offline/dto";
import { IPagination, IPaginationResult } from "./i-pagination";

/**
	* Interface for the Audit Log Service
	* This service is responsible for managing audit log data, including saving, retrieving, and updating audit log entries.
	* @template T The type of audit log data being managed
 */
export interface IAuditLogService<T> {
	findAuditLogs(inputParams: IPagination<T>): Promise<IPaginationResult<AuditLogTO>>;
	save(log: T): Promise<void>;
	saveAndReturn(log: T): Promise<AuditLogTO>;
	update(log: Partial<T>): Promise<void>;
	remove(log: Partial<T>): Promise<void>;
	findById(id: number): Promise<AuditLogTO | null>;
}

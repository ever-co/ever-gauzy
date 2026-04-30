export interface AuditLogTO {
	id?: number;
	logLevel: string;
	message: string;
	createdAt?: Date;
	serviceName: string;
}

export const TABLE_NAME_AUDIT_LOG: string = 'desktop_audit_log';

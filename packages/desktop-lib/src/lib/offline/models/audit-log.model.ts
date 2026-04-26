import { Serializable } from '../../interfaces';
import { AuditLogTO } from '../dto/audit-log.dto';
export class AuditLog implements AuditLogTO, Serializable<AuditLogTO> {
	private _id: number;
	private _logLevel: string;
	private _message: string;
	private _createdAt: Date;
	private _serviceName: string;

	constructor(auditLog: AuditLogTO) {
		this._logLevel = auditLog.logLevel;
		this._message = auditLog.message;
		this._createdAt = auditLog.createdAt;
		this._serviceName = auditLog.serviceName;
		this._id = auditLog.id;
	}

	public get id(): number {
		return this._id;
	}

	public set id(value: number) {
		this._id = value;
	}

	public get logLevel(): string {
		return this._logLevel;
	}

	public set logLevel(value: string) {
		this._logLevel = value;
	}

	public get message(): string {
		return this._message;
	}

	public set message(value: string) {
		this._message = value;
	}

	public get createdAt(): Date {
		return this._createdAt;
	}

	public set createdAt(value: Date) {
		this._createdAt = value;
	}

	public get serviceName(): string {
		return this._serviceName;
	}

	public set serviceName(value: string) {
		this._serviceName = value;
	}

	toObject(): AuditLogTO {
		return {
			id: this.id,
			logLevel: this.logLevel,
			message: this.message,
			serviceName: this.serviceName,
			createdAt: this.createdAt,
		}
	}
}

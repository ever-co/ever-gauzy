
import { Serializable } from '../../interfaces';
import { AuditQueueTO } from '../dto/queue-audit.dto';
import { Base } from './base.model';

export class AuditQueue implements AuditQueueTO, Serializable<AuditQueueTO> {
	private _queue: string;
	private _status: string;
	private _attempts: number;
	private _priority: number;
	private _data: Record<string, unknown> | string;
	private _created_at: Date;
	private _started_at: Date;
	private _finished_at: Date;
	private _last_error: string;
	private _id: number;
	private _queue_id: string;

	constructor(auditQueue: AuditQueueTO) {
		this._queue = auditQueue.queue;
		this._status = auditQueue.status;
		this._attempts = auditQueue.attempts;
		this._priority = auditQueue.priority;
		this._data = auditQueue.data;
		this._created_at = auditQueue.created_at;
		this._started_at = auditQueue.started_at;
		this._finished_at = auditQueue.finished_at;
		this._last_error = auditQueue.last_error;
		this._id = auditQueue.id;
		this._queue_id = auditQueue.queue_id;
	}

	public get id(): number {
		return this._id;
	}

	public set id(value: number) {
		this._id = value;
	}

	public get queue_id(): string {
		return this._queue_id;
	}

	public set queue_id(value: string) {
		this.queue_id = value;
	}

	public get queue(): string {
		return this._queue;
	}
	public set queue(value: string) {
		this.queue = value;
	}

	public get status(): string {
		return this._status;
	}
	public set status(value: string) {
		this.status = value;
	}

	public get attempts(): number {
		return this._attempts;
	}

	public set attempts(value: number) {
		this._attempts = value;
	}

	public get priority(): number {
		return this._priority;
	}

	public set priority(value: number) {
		this._priority = value;
	}

	public get data(): Record<string, unknown> | string {
		return this._data;
	}

	public set data (value: Record<string, unknown> | string) {
		this._data = value;
	}

	public get created_at(): Date {
		return this._created_at;
	}

	public set created_at(value: Date) {
		this._created_at = value;
	}

	public get started_at(): Date {
		return this._started_at;
	}

	public set started_at(value: Date) {
		this._started_at = value;
	}

	public get finished_at(): Date {
		return this._finished_at;
	}

	public set finished_at(value: Date) {
		this._finished_at = value;
	}

	public get last_error(): string {
		return this._last_error;
	}
	public set last_error(value: string) {
		this._last_error = value;
	}

	public toObject(): AuditQueueTO {
		return {
			queue_id: this.queue_id,
			queue: this.queue,
			status: this.status,
			attempts: this.attempts,
			priority: this.priority,
			data: this.data,
			created_at: this.created_at,
			started_at: this.started_at,
			finished_at: this.finished_at,
			last_error: this.last_error,
			id: this.id
		};
	}
}

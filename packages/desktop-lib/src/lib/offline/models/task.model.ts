import { Serializable } from '../../interfaces';
import { TagTO } from '../dto/tag.dto';
import { TaskTO } from '../dto/task.dto';
import { UserTO } from '../dto/user.dto';
import { Base } from './base.model';

export class Task extends Base implements TaskTO, Serializable<TaskTO> {
	private _creatorId: string;
	private _description: string;
	private _dueDate: string;
	private _estimate: number;
	private _members: UserTO[];
	private _projectId: string;
	private _status: string;
	private _tags: TagTO[];
	private _title: string;
	private _taskNumber: string;

	constructor(task: TaskTO) {
		super(task.id, task.organizationId, task.remoteId, task.tenantId);
		this._creatorId = task.creatorId;
		this._description = task.description;
		this._dueDate = task.dueDate;
		this._estimate = task.estimate;
		this._members = task.members;
		this._projectId = task.projectId;
		this._status = task.status;
		this._tags = task.tags;
		this._title = task.title;
		this._taskNumber = task.taskNumber;
	}

	public get creatorId(): string {
		return this._creatorId;
	}
	public set creatorId(value: string) {
		this._creatorId = value;
	}
	public get description(): string {
		return this._description;
	}
	public set description(value: string) {
		this._description = value;
	}
	public get dueDate(): string {
		return this._dueDate;
	}
	public set dueDate(value: string) {
		this._dueDate = value;
	}
	public get estimate(): number {
		return this._estimate;
	}
	public set estimate(value: number) {
		this._estimate = value;
	}
	public get members(): UserTO[] {
		return this._members;
	}
	public set members(value: UserTO[]) {
		this._members = value;
	}
	public get projectId(): string {
		return this._projectId;
	}
	public set projectId(value: string) {
		this._projectId = value;
	}
	public get status(): string {
		return this._status;
	}
	public set status(value: string) {
		this._status = value;
	}
	public get tags(): TagTO[] {
		return this._tags;
	}
	public set tags(value: TagTO[]) {
		this._tags = value;
	}
	public get title(): string {
		return this._title;
	}
	public set title(value: string) {
		this._title = value;
	}
	public get taskNumber(): string {
		return this._taskNumber;
	}
	public set taskNumber(value: string) {
		this._taskNumber = value;
	}
	public toObject(): TaskTO {
		return {
			...super.toObject(),
			tags: this._tags,
			taskNumber: this._taskNumber,
			title: this._title,
			status: this._status,
			projectId: this._projectId,
			members: this._members,
			estimate: this._estimate,
			dueDate: this._dueDate,
			description: this._description,
			creatorId: this._creatorId
		};
	}
}

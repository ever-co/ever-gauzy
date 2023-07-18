import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	RelationId,
} from 'typeorm';
import { IsEnum, IsUUID } from 'class-validator';
import {
	ITask,
	ITaskLinkedIssue,
	TaskRelatedIssuesRelationEnum,
} from '@gauzy/contracts';
import { Task } from './../task.entity';
import { TenantOrganizationBaseEntity } from './../../core/entities/internal';

@Entity('task_linked_issues')
export class TaskLinkedIssue
	extends TenantOrganizationBaseEntity
	implements ITaskLinkedIssue
{
	@ApiProperty({ type: () => String, enum: TaskRelatedIssuesRelationEnum })
	@Column()
	@IsEnum(TaskRelatedIssuesRelationEnum)
	action: TaskRelatedIssuesRelationEnum;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */
	@ApiPropertyOptional({ type: () => Task })
	@ManyToOne(() => Task)
	@JoinColumn()
	taskFrom?: ITask;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TaskLinkedIssue) => it.taskFrom)
	@Index()
	@Column()
	taskFromId: ITask['id'];

	/**
	 * Task Linked Issues
	 */
	@ApiPropertyOptional({ type: () => Object })
	@ManyToOne(() => Task, (it) => it.linkedIssues)
	@JoinColumn()
	taskTo?: ITask;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TaskLinkedIssue) => it.taskTo)
	@Index()
	@Column()
	taskToId: ITask['id'];
}

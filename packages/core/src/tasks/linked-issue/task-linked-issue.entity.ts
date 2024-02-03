import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Index,
	JoinColumn,
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
import { MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmTaskLinkedIssueRepository } from './repository/mikro-orm-linked-issue.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('task_linked_issues', { mikroOrmRepository: () => MikroOrmTaskLinkedIssueRepository })
export class TaskLinkedIssue extends TenantOrganizationBaseEntity implements ITaskLinkedIssue {
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
	@MultiORMManyToOne(() => Task)
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
	@MultiORMManyToOne(() => Task, (it) => it.linkedIssues)
	@JoinColumn()
	taskTo?: ITask;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TaskLinkedIssue) => it.taskTo)
	@Index()
	@Column()
	taskToId: ITask['id'];
}

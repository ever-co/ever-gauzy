import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ID, ITask, ITaskLinkedIssue, TaskRelatedIssuesRelationEnum } from '@gauzy/contracts';
import { Task } from './../task.entity';
import { TenantOrganizationBaseEntity } from './../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../../core/decorators/entity';
import { MikroOrmTaskLinkedIssueRepository } from './repository/mikro-orm-linked-issue.repository';

@MultiORMEntity('task_linked_issues', { mikroOrmRepository: () => MikroOrmTaskLinkedIssueRepository })
export class TaskLinkedIssue extends TenantOrganizationBaseEntity implements ITaskLinkedIssue {
	@ApiProperty({ enum: TaskRelatedIssuesRelationEnum })
	@IsEnum(TaskRelatedIssuesRelationEnum)
	@MultiORMColumn()
	action: TaskRelatedIssuesRelationEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@MultiORMManyToOne(() => Task)
	@JoinColumn()
	taskFrom?: ITask;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TaskLinkedIssue) => it.taskFrom)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskFromId: ID;

	/**
	 * Task Linked Issues
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => Task, (it) => it.linkedIssues)
	@JoinColumn()
	taskTo?: ITask;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TaskLinkedIssue) => it.taskTo)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskToId: ID;
}

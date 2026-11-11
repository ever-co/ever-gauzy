import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { isMySQL } from '@gauzy/config';
import { ID, IOrganizationProject, ITask, ITaskFormerReference } from '@gauzy/contracts';
import { OrganizationProject, Task, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';

/**
 * A reference a task held before it moved to another project (`API-42` after the task became `SYS-7`), written by the
 * update that moves the task, in the same transaction. `resolveReferences` falls back to it when no live task of the
 * project holds the number, and the next number a project hands out counts it, so the number is never given to
 * another task of that project.
 */
@MultiORMEntity('task_former_reference')
@ColumnIndex('IDX_task_former_reference_project_number', ['tenantId', 'organizationId', 'projectId', 'number'])
export class TaskFormerReference extends TenantOrganizationBaseEntity implements ITaskFormerReference {
	/** The number the task held in the project it left. */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ ...(isMySQL() ? { type: 'bigint' } : {}) })
	number: number;

	/** The prefix the task carried in the project it left (the first three characters of that project's name). */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	prefix?: string | null;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The task that held the reference. Its former references go with it. */
	@MultiORMManyToOne(() => Task, { onDelete: 'CASCADE' })
	task?: ITask;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TaskFormerReference) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskId: ID;

	/** The project the task left. A reference of a project that is gone resolves to nothing. */
	@MultiORMManyToOne(() => OrganizationProject, { onDelete: 'CASCADE' })
	project?: IOrganizationProject;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TaskFormerReference) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	projectId: ID;
}

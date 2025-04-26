import { JoinColumn, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID } from 'class-validator';
import { ID, IOrganizationProject, ITaskProjectSequence } from '@gauzy/contracts';
import { OrganizationProject, BaseEntity } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from './../../core/decorators/entity';
import { MikroOrmTaskProjectSequenceRepository } from './repository/mikro-orm-task-project-sequence.repository';

@MultiORMEntity('task_project_sequence', { mikroOrmRepository: () => MikroOrmTaskProjectSequenceRepository })
@ColumnIndex('projectSequence', ['projectId'], { unique: true })
export class TaskProjectSequence extends BaseEntity implements ITaskProjectSequence {
	[EntityRepositoryType]?: MikroOrmTaskProjectSequenceRepository;

	/**
	 * Organization Project
	 */
	@MultiORMOneToOne(() => OrganizationProject, (it) => it.tasks, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project: IOrganizationProject;

	@ApiProperty({ type: () => String, uniqueItems: true })
	@IsUUID()
	@RelationId((it: TaskProjectSequence) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	projectId: ID;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn()
	taskNumber: number;
}

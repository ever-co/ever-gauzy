import { JoinColumn, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { EntityRepositoryType, PrimaryKey } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsUUID } from 'class-validator';
import { ID, IOrganizationProject, ITaskProjectSequence } from '@gauzy/contracts';
import { OrganizationProject } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from './../../core/decorators/entity';
import { MikroOrmTaskProjectSequenceRepository } from './repository/mikro-orm-task-project-sequence.repository';

@MultiORMEntity('task_project_sequence', { mikroOrmRepository: () => MikroOrmTaskProjectSequenceRepository })
@ColumnIndex('projectSequence', ['projectId'], { unique: true })
export class TaskProjectSequence implements ITaskProjectSequence {
	[EntityRepositoryType]?: MikroOrmTaskProjectSequenceRepository;

	// Primary key of UUID type
	@ApiPropertyOptional({ type: () => String })
	@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' }) // For Mikro-ORM compatibility
	@PrimaryGeneratedColumn('uuid')
	id?: ID;

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

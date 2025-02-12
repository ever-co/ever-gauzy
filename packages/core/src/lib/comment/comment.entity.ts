import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ActorTypeEnum, IComment, ID, IEmployee, IOrganizationTeam } from '@gauzy/contracts';
import { BasePerEntityType, Employee, OrganizationTeam } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { ActorTypeTransformer } from '../shared/pipes';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@MultiORMEntity('comment', { mikroOrmRepository: () => MikroOrmCommentRepository })
export class Comment extends BasePerEntityType implements IComment {
	[EntityRepositoryType]?: MikroOrmCommentRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'text' })
	comment: string;

	@ApiPropertyOptional({ enum: ActorTypeEnum })
	@IsOptional()
	@IsEnum(ActorTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', nullable: true, transformer: new ActorTypeTransformer() })
	actorType?: ActorTypeEnum; // Will be stored as 0 or 1 in DB

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	resolved?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	resolvedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	editedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Comment author
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	/**
	 * Comment author ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Comment) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * Resolved by
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	resolvedBy?: IEmployee;

	/**
	 * Resolved by ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Comment) => it.resolvedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	resolvedById?: ID;

	/**
	 * Comment parent-child relationship
	 */
	@MultiORMManyToOne(() => Comment, (comment) => comment.replies, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	parent?: IComment;

	/**
	 * Parent ID of comment
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Replies comments
	 */
	@MultiORMOneToMany(() => Comment, (comment) => comment.parent)
	replies?: IComment[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 *
	 */
	@MultiORMManyToMany(() => Employee, (employee) => employee.assignedComments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'comment_employee',
		joinColumn: 'commentId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({ name: 'comment_employee' })
	members?: IEmployee[];

	/**
	 *
	 */
	@MultiORMManyToMany(() => OrganizationTeam, (team) => team.assignedComments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'comment_team',
		joinColumn: 'commentId',
		inverseJoinColumn: 'organizationTeamId'
	})
	@JoinTable({ name: 'comment_team' })
	teams?: IOrganizationTeam[];
}

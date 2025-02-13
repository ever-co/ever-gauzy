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
	@JoinColumn()
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
	resolvedByEmployee?: IEmployee;

	/**
	 * Resolved by ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Comment) => it.resolvedByEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	resolvedByEmployeeId?: ID;

	/**
	 * Comment parent-child relationship
	 */
	@MultiORMManyToOne(() => Comment, (comment) => comment.replies, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
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
	 * Comment members
	 */
	@MultiORMManyToMany(() => Employee, (employee) => employee.assignedComments, {
		onUpdate: 'CASCADE', // Cascade action on update
		onDelete: 'CASCADE', // Cascade action on delete
		owner: true, // Ownership
		pivotTable: 'comment_employee', // Table name for pivot table
		joinColumn: 'commentId', // Column name for join table
		inverseJoinColumn: 'employeeId' // Column name for inverse join table
	})
	@JoinTable({ name: 'comment_employee' })
	members?: IEmployee[];

	/**
	 * Comment teams
	 */
	@MultiORMManyToMany(() => OrganizationTeam, (team) => team.assignedComments, {
		onUpdate: 'CASCADE', // Cascade action on update
		onDelete: 'CASCADE', // Cascade action on delete
		owner: true, // Ownership
		pivotTable: 'comment_team', // Table name for pivot table
		joinColumn: 'commentId', // Column name for join table
		inverseJoinColumn: 'organizationTeamId' // Column name for inverse join table
	})
	@JoinTable({ name: 'comment_team' })
	teams?: IOrganizationTeam[];
}

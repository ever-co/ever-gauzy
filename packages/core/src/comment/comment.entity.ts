import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { IsArray, IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { CommentEntityEnum, IComment, ID, IEmployee, IOrganizationTeam } from '@gauzy/contracts';
import { Employee, OrganizationTeam, TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@MultiORMEntity('comment', { mikroOrmRepository: () => MikroOrmCommentRepository })
export class Comment extends TenantOrganizationBaseEntity implements IComment {
	[EntityRepositoryType]?: MikroOrmCommentRepository;

	@ApiProperty({ type: () => String, enum: CommentEntityEnum })
	@IsNotEmpty()
	@IsEnum(CommentEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: CommentEntityEnum;

	// Indicate the ID of entity record commented
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	comment: string;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	resolved?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@MultiORMColumn()
	resolvedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee comment author
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: Comment) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId: ID;

	/**
	 * Employee marked comment as resolved
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	resolvedBy?: IEmployee;

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
	@ApiPropertyOptional({ type: () => Comment })
	@IsOptional()
	@MultiORMManyToOne(() => Comment, (comment) => comment.replies, {
		onDelete: 'SET NULL'
	})
	parent?: IComment;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
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
	 * Members
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Employee, (employee) => employee.assignedComments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'comment_employee',
		joinColumn: 'commentId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({
		name: 'comment_employee'
	})
	members?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationTeam, (team) => team.assignedComments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'comment_team',
		joinColumn: 'commentId',
		inverseJoinColumn: 'organizationTeamId'
	})
	@JoinTable({
		name: 'comment_team'
	})
	teams?: IOrganizationTeam[];
}

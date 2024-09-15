import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { IsArray, IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ActorTypeEnum, CommentEntityEnum, IComment, ID, IEmployee, IOrganizationTeam, IUser } from '@gauzy/contracts';
import { Employee, OrganizationTeam, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
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
	entityId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'text' })
	comment: string;

	@ApiPropertyOptional({ type: () => String, enum: ActorTypeEnum })
	@IsNotEmpty()
	@IsEnum(ActorTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	actorType?: ActorTypeEnum;

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
	 * User comment author
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Comment) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;

	/**
	 * User marked comment as resolved
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	resolvedBy?: IUser;

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

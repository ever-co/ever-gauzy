import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IEmployee, IReaction, IUser, ReactionEntityEnum } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmReactionRepository } from './repository/mikro-orm-reaction.repository';

@MultiORMEntity('reaction', { mikroOrmRepository: () => MikroOrmReactionRepository })
export class Reaction extends TenantOrganizationBaseEntity implements IReaction {
	[EntityRepositoryType]?: MikroOrmReactionRepository;

	@ApiProperty({ type: () => String, enum: ReactionEntityEnum })
	@IsNotEmpty()
	@IsEnum(ReactionEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: ReactionEntityEnum;

	// Indicate the ID of entity record reacted
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	emoji: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on update. */
		onUpdate: 'CASCADE',

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Reaction) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * User reaction creator
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
	createdBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Reaction) => it.createdBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	createdById?: ID;
}

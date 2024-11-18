import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IReaction, IUser, ReactionEntityEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
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

	/**
	 * User reaction author
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
	@RelationId((it: Reaction) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;
}

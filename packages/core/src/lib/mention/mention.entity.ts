import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { BaseEntityEnum, ID, IMention, IUser } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmMentionRepository } from './repository/mikro-orm-mention.repository';

@MultiORMEntity('mention', { mikroOrmRepository: () => MikroOrmMentionRepository })
export class Mention extends TenantOrganizationBaseEntity implements IMention {
	[EntityRepositoryType]?: MikroOrmMentionRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: ID;

	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsNotEmpty()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: BaseEntityEnum;

	/**
	 * The parent entity ID
	 *
	 * E.g : If the user was mentioned is in a comment, we need this for subscription and notifications purpose (It could be the `task ID` concerned by comment, then the user will be subscribed to that task instead of to a comment itself because in this case, `entityId` will store the comment ID)
	 */
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentEntityId?: ID;

	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsOptional()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentEntityType?: BaseEntityEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Mentioned User
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
	mentionedUser?: IUser;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: Mention) => it.mentionedUser)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	mentionedUserId: ID;

	/**
	 * The User that mentioned another
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
	mentionBy?: IUser;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: Mention) => it.mentionBy)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	mentionById: ID;
}

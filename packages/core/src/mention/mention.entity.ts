import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
	entityId: string;

	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsNotEmpty()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: BaseEntityEnum;

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

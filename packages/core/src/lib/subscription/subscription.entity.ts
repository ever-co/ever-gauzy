import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { ID, ISubscription, IUser, SubscriptionTypeEnum } from '@gauzy/contracts';
import { BasePerEntityType, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmSubscriptionRepository } from './repository/mikro-orm-subscription.repository';

@MultiORMEntity('subscription', { mikroOrmRepository: () => MikroOrmSubscriptionRepository })
export class Subscription extends BasePerEntityType implements ISubscription {
	[ EntityRepositoryType ]?: MikroOrmSubscriptionRepository;

	@ApiProperty({ type: () => String, enum: SubscriptionTypeEnum })
	@IsNotEmpty()
	@IsEnum(SubscriptionTypeEnum)
	@ColumnIndex()
	@MultiORMColumn()
	type: SubscriptionTypeEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Subscribed User
	 */
	@ApiPropertyOptional({ type: () => Object })
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: Subscription) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ActorTypeEnum, ID, IEmployee, IEntitySubscription, EntitySubscriptionTypeEnum } from '@gauzy/contracts';
import { BasePerEntityType, Employee } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ActorTypeTransformer } from '../shared/pipes';
import { MikroOrmEntitySubscriptionRepository } from './repository/mikro-orm-entity-subscription.repository';

@MultiORMEntity('entity_subscription', { mikroOrmRepository: () => MikroOrmEntitySubscriptionRepository })
export class EntitySubscription extends BasePerEntityType implements IEntitySubscription {
	[EntityRepositoryType]?: MikroOrmEntitySubscriptionRepository;

	// Indicate the actor type
	@ApiPropertyOptional({ enum: ActorTypeEnum })
	@IsOptional()
	@IsEnum(ActorTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', nullable: true, transformer: new ActorTypeTransformer() })
	actorType?: ActorTypeEnum; // Will be stored as 0 or 1 in DB

	/**
	 * The type of subscription.
	 */
	@ApiProperty({ type: () => String, enum: EntitySubscriptionTypeEnum })
	@IsNotEmpty()
	@IsEnum(EntitySubscriptionTypeEnum)
	@ColumnIndex()
	@MultiORMColumn()
	type: EntitySubscriptionTypeEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employee who subscribed to the entity.
	 */
	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Employee, {
		nullable: true, // Indicates if relation column value can be null.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The employee id who subscribed to the entity.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EntitySubscription) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}

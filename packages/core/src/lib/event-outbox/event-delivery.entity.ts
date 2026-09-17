import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EventOutboxStatus, ID, IEventDelivery } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmEventDeliveryRepository } from './repository/mikro-orm-event-delivery.repository';

/**
 * One row per `(event, consumer)`, and the reason a consumer can be written naively.
 *
 * The unique pair `(eventId, consumerKey)` is the mechanism, not a nicety: the row is created
 * *before* the consumer is invoked, so a consumer that tries to process the same event twice fails
 * the insert and skips the work, and a consumer that crashes leaves a pending row the retry scan
 * picks up. That is what turns at-least-once dispatch into an at-most-once effect.
 *
 * There is deliberately no foreign key to `event_outbox`: delivery rows outlive outbox retention
 * and are the record of what a consumer actually did.
 */
@MultiORMEntity('event_delivery', { mikroOrmRepository: () => MikroOrmEventDeliveryRepository })
export class EventDelivery extends TenantOrganizationBaseEntity implements IEventDelivery {
	/**
	 * The `event_outbox.eventId` this record is about.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	eventId: ID;

	/**
	 * `<kind>:<key>` — `subscriber:<name>`, `job:<queue>` or `webhook:<subscriptionId>`.
	 *
	 * 191 characters because a MySQL index over a `varchar` is limited by byte length once the
	 * charset is taken into account, and this column is always indexed.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 191 })
	consumerKey: string;

	/**
	 * Where this consumer stands. Reuses the outbox vocabulary so one scan and one retry policy
	 * cover both tables.
	 */
	@ApiProperty({ type: () => String, enum: EventOutboxStatus })
	@IsEnum(EventOutboxStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: EventOutboxStatus.PENDING })
	status: EventOutboxStatus;

	/**
	 * Times the consumer was invoked.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	attemptCount: number;

	/**
	 * When the consumer acknowledged the event.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	deliveredAt?: Date;

	/**
	 * Last consumer error.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	/**
	 * Copied from the outbox row, so the retry scan can keep per-aggregate ordering without a join.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	partitionKey?: string;

	/**
	 * Copied from the outbox row; a strict consumer compares it against the last it processed.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'bigint', nullable: true, transformer: new ColumnNumericTransformerPipe() })
	sequence?: number;
}

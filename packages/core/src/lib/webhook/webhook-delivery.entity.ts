import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { RelationId } from 'typeorm';
import { ID, IWebhookDelivery, JsonData, WebhookDeliveryStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { WebhookSubscription } from './webhook-subscription.entity';
import { MikroOrmWebhookDeliveryRepository } from './repository/mikro-orm-webhook-delivery.repository';

/**
 * One delivery of one event to one subscription.
 *
 * `(subscriptionId, eventId)` is unique, which is what makes the dispatcher idempotent: a re-run of
 * the dispatch pass cannot double-send, because the second attempt at the same pair fails the
 * insert. The payload is stored when the row is created and never regenerated, so a replay sends
 * exactly what was originally intended, and the retry schedule is data — `nextAttemptAt` — rather
 * than a backoff recomputed in code.
 */
@MultiORMEntity('webhook_delivery', { mikroOrmRepository: () => MikroOrmWebhookDeliveryRepository })
export class WebhookDelivery extends TenantOrganizationBaseEntity implements IWebhookDelivery {
	/**
	 * The subscription this delivery belongs to.
	 */
	@ApiProperty({ type: () => WebhookSubscription })
	@MultiORMManyToOne(() => WebhookSubscription, (subscription) => subscription.deliveries, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	subscription?: WebhookSubscription;

	/**
	 * Id of the owning subscription.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: WebhookDelivery) => it.subscription)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	subscriptionId: ID;

	/**
	 * The `event_outbox.eventId` this delivery carries.
	 *
	 * No foreign key: deliveries outlive outbox retention, and the pair with the subscription is the
	 * identity that matters.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	eventId: ID;

	/**
	 * Denormalised so a delivery list is readable without the outbox row.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 160 })
	eventName: string;

	/**
	 * The exact body that will be, or was, sent.
	 */
	@ApiProperty({ type: () => Object })
	@JsonColumn<JsonData>({ defaultValue: {} })
	payload: JsonData;

	/**
	 * Where the delivery stands.
	 */
	@ApiProperty({ type: () => String, enum: WebhookDeliveryStatus })
	@IsEnum(WebhookDeliveryStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: WebhookDeliveryStatus.PENDING })
	status: WebhookDeliveryStatus;

	/**
	 * Times the endpoint was called.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	attemptCount: number;

	/**
	 * HTTP status of the last attempt.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	responseStatus?: number;

	/**
	 * Truncated response body, for triage.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	responseBody?: string;

	/**
	 * How long the last attempt took.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	durationMs?: number;

	/**
	 * When the next attempt is due: the retry scan key.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	nextAttemptAt?: Date;

	/**
	 * When the endpoint acknowledged the delivery.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	deliveredAt?: Date;

	/**
	 * Transport, TLS or timeout error of the last attempt.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;
}

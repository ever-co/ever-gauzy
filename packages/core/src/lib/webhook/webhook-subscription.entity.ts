import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUrl, IsUUID, Min } from 'class-validator';
import { ID, IWebhookSubscription, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonArrayColumn,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { IsSecret } from '../core/decorators/is-secret';
import { WebhookDelivery } from './webhook-delivery.entity';
import { MikroOrmWebhookSubscriptionRepository } from './repository/mikro-orm-webhook-subscription.repository';

/**
 * An outbound delivery endpoint.
 *
 * A subscription is how a consumer outside the platform receives events: any domain that writes to
 * the outbox is immediately subscribable, because the dispatcher matches an event name against these
 * patterns at dispatch time. One subscription per `(organization, url)` — a duplicate endpoint would
 * double-deliver every event — and an endpoint that keeps failing is disabled rather than left to be
 * hammered forever.
 */
@MultiORMEntity('webhook_subscription', { mikroOrmRepository: () => MikroOrmWebhookSubscriptionRepository })
export class WebhookSubscription extends TenantOrganizationBaseEntity implements IWebhookSubscription {
	/**
	 * Operator-facing name.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Absolute HTTPS endpoint.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@IsUrl({ require_tld: false })
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 1024 })
	url: string;

	/**
	 * HMAC signing secret.
	 *
	 * Stored encrypted, marked secret so that no serializer or log line can carry it, and read back
	 * only by the delivery runtime at the moment it signs a payload.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@IsSecret()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	secret: string;

	/**
	 * Subscribed event names or patterns.
	 *
	 * Held as JSON rather than as the `simple-array` form the schema notes, because a `simple-array`
	 * column is understood by one ORM only and this build runs both.
	 */
	@ApiProperty({ type: () => Array })
	@IsArray()
	@JsonArrayColumn<string>()
	events: string[];

	/**
	 * Channel the subscription listens to; null means every channel.
	 *
	 * Stored as a plain identifier rather than a foreign key, so a subscription can be created before
	 * the sales-surface capability is configured; the relation and its `SET NULL` rule are introduced
	 * together with the channel table.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	channelId?: ID;

	/**
	 * Free-text note for operators.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Static extra headers sent with every delivery.
	 *
	 * Non-secret by contract: these are routing hints a receiver needs, and a secret placed here would
	 * travel in cleartext on every attempt.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	headers?: JsonData;

	/**
	 * Contract version the consumer expects, echoed in the delivery headers.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	apiVersion?: string;

	/**
	 * Consecutive failures; reset on success.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	failureCount: number;

	/**
	 * When the endpoint last accepted a delivery.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	lastSuccessAt?: Date;

	/**
	 * When the endpoint last refused one.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	lastFailureAt?: Date;

	/**
	 * Set when the failure count crossed the auto-disable threshold.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	disabledAt?: Date;

	/**
	 * Operator metadata, including the previous secret and its expiry during a rotation.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/**
	 * The deliveries of this subscription.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@MultiORMOneToMany(() => WebhookDelivery, (delivery) => delivery.subscription, {
		onDelete: 'CASCADE'
	})
	deliveries?: WebhookDelivery[];
}

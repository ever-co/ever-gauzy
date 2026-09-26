import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { IChannel, IChannelDomain, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from '../core/decorators/entity';
import { Channel } from '../channel/channel.entity';
import { MikroOrmChannelDomainRepository } from './repository/mikro-orm-channel-domain.repository';

/**
 * Hostname → channel resolution for a deployment that serves several channels.
 *
 * **One row, one question.** The row exists so that an incoming `Host` header resolves to a channel in
 * one indexed read, before any other guard runs: the channel-scope guard has to know which channel a
 * request is for before it can decide whether the caller may see it, and asking the channel table that
 * question would mean reading every channel of every tenant on every request.
 *
 * **The hostname is unique across the whole deployment, not per tenant.** The header is global, so two
 * tenants claiming the same host would make the resolution ambiguous in exactly the request that cannot
 * ask a question first. The uniqueness is a partial unique index over the live rows; MySQL expresses it
 * with the documented generated `deletedKey` column, because that dialect has no filtered index.
 *
 * **Exactly one primary per channel.** The primary host is the canonical one — it is what a storefront
 * link is written with and what the others redirect to — so at most one live row per channel carries the
 * flag. MySQL expresses that rule with a generated `isPrimaryKey`, the same form the channel's own
 * default rule uses.
 *
 * **A channel must carry at least one hostname before it can serve** (invariant I-25). The check belongs
 * to the operation that moves a channel into `ACTIVE`, and this table is where it reads the answer.
 */
@ColumnIndex('UQ_channel_domain_hostname', ['hostname'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('UQ_channel_domain_primary', ['channelId'], {
	unique: true,
	where: '"isPrimary" = true AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_channel_domain_channel', ['channelId'])
@MultiORMEntity('channel_domain', { mikroOrmRepository: () => MikroOrmChannelDomainRepository })
export class ChannelDomain extends TenantOrganizationBaseEntity implements IChannelDomain {
	/**
	 * The channel this hostname resolves to.
	 *
	 * Cascades: a hostname that resolves to nothing is a request that can never be answered, so leaving
	 * the rows behind when their channel is hard-deleted would be leaving a trap. The channel is
	 * normally archived rather than deleted, and this constraint is what a retention job's delete
	 * relies on.
	 */
	@ApiProperty({ type: () => Channel })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Channel, (it) => it.domains, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	channel: IChannel;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ChannelDomain) => it.channel)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	channelId: ID;

	/**
	 * Lower-cased hostname, without scheme and without a trailing slash.
	 *
	 * Stored in the form an incoming header is normalised to, and only in that form: a row that kept the
	 * caller's spelling would resolve for one client and not for the next. Uniqueness is over the live
	 * rows of the whole deployment.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@IsNotEmpty()
	@MinLength(1)
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	hostname: string;

	/**
	 * Whether this is the channel's canonical host.
	 *
	 * At most one live row per channel carries it: the primary is what a storefront link is written
	 * with, and two candidates would make a canonical link depend on read order.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isPrimary: boolean;

	/**
	 * When false the host is served over plain HTTP.
	 *
	 * A column rather than a deployment-wide setting: a development or internal host legitimately has
	 * no certificate while the production hosts of the same tenant do, and the flag is what tells the
	 * storefront to build an `http` link instead of sending the visitor to a certificate that does not
	 * exist.
	 */
	@ApiProperty({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isSslEnabled: boolean;

	/**
	 * Whether a request to this host is redirected to the channel's primary host.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	redirectToPrimary: boolean;

	/**
	 * Tenant extras: the certificate reference, a content-delivery identifier.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}

import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength,
	Min
} from 'class-validator';
import {
	ChannelStatus,
	CurrencyCode,
	IChannel,
	IChannelDomain,
	IChannelRegion,
	ID,
	IRegion,
	JsonData
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { ChannelDomain } from '../channel-domain/channel-domain.entity';
import { ChannelRegion } from '../channel-region/channel-region.entity';
import { Region } from '../region/region.entity';
import { MikroOrmChannelRepository } from './repository/mikro-orm-channel.repository';

/**
 * The sales context: a storefront, a marketplace listing, a point of sale, a B2B portal.
 *
 * **Why the row exists.** Everything the platform resolves commercially is resolved *for a channel*:
 * which catalogue entries are published, which price list applies, which stock location serves, which
 * promotions are candidates and which settings override the organization's. Without a channel row there
 * is nothing to resolve those against, and every one of the columns that already point here — a tenant
 * setting, an order, a cart, a price list, a webhook subscription, a numbering series, a pick wave —
 * names a row that does not exist.
 *
 * **The three rules the row carries.**
 *
 * 1. **At most one default per organization.** `isDefault` is guarded by a partial unique index on the
 *    live rows, so two defaults are impossible rather than merely discouraged; the operation that
 *    claims the flag releases it from the previous holder in the same transaction, because a partial
 *    unique index can express "at most one" and not "move it".
 * 2. **`code` is the channel's identity.** It is what a URL, a seed and an import are written against,
 *    it is unique per organization among live rows, and it is written once — the schema makes it
 *    immutable once an order names the channel, and a channel that has been traded on is archived
 *    rather than deleted.
 * 3. **A channel that serves has at least one hostname.** `domains` is how an incoming request resolves
 *    to this row at all, so the service refuses to move a channel into `ACTIVE` while it carries none.
 *
 * **The relations are declared with the entity classes their decorators need and typed by their
 * contract interfaces.** A relation property that named an entity class across a mutual import would
 * make the two modules depend on each other's initialisation order, which is how a mapper ends up
 * reading a class that is still `undefined`; the property is typed by the interface instead, which is
 * also what a consumer sees.
 */
@ColumnIndex('UQ_channel_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('UQ_channel_default', ['organizationId'], {
	unique: true,
	where: '"isDefault" = true AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_channel_org_status', ['organizationId', 'status'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_channel_default_region', ['defaultRegionId'])
// Two of the four indexes above cannot be created on MySQL as written: the dialect has no filtered
// index. `UQ_channel_org_code` takes the documented nullable-key fallback — a stored generated
// `deletedKey` column that is `'0'` while the row is live and the row's own id once it is deleted —
// and `UQ_channel_default` takes the form the schema chapter prescribes for a boolean guard, a stored
// generated `isDefaultKey` that is `1` while the row is the live default and `NULL` otherwise. Both
// generated columns exist on MySQL only and are declared by no entity; the migration creates them.
// `IDX_channel_org_status` is a lookup narrowing rather than a uniqueness rule, so MySQL gets it
// without its predicate.
@MultiORMEntity('channel', { mikroOrmRepository: () => MikroOrmChannelRepository })
export class Channel extends TenantOrganizationBaseEntity implements IChannel {
	/**
	 * Admin-facing name.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Stable key, unique per organization among live rows.
	 *
	 * Written once: it appears in storefront URLs, in seed files and in import mappings, so a change to
	 * it is a change to every artefact that names the channel. The supported path for a channel that is
	 * no longer wanted is `status = ARCHIVED`, which keeps the code resolvable for the orders that
	 * carry it.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Free-text description shown in the administration surface.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Where the channel stands in its life.
	 *
	 * Only `ACTIVE` serves requests. `DRAFT` is a channel being configured, `INACTIVE` one temporarily
	 * withdrawn, and `ARCHIVED` one retained because orders name it; `ARCHIVED` is terminal, and a
	 * channel that has been traded on is never hard-deleted — the constraint from the order side is
	 * `RESTRICT` precisely so that an accidental delete fails loudly instead of orphaning documents.
	 */
	@ApiProperty({ type: () => String, enum: ChannelStatus, default: ChannelStatus.ACTIVE })
	@IsEnum(ChannelStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: ChannelStatus, default: ChannelStatus.ACTIVE })
	status: ChannelStatus;

	/**
	 * Whether this is the organization's default channel.
	 *
	 * At most one live row per organization carries it. The administration surface falls back to it when
	 * an operator states no channel; a *request* that states none is refused rather than defaulted,
	 * because silently pricing a cart through another storefront's configuration is the leak the
	 * channel-scope guard exists to prevent.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * Currency of a cart created without an explicit currency.
	 *
	 * The column carries a database default so a row written by a path that states no currency still
	 * lands in a valid state; the service states the organization's own currency, which is the value
	 * the schema chapter names for this column.
	 */
	@ApiProperty({ type: () => String, maxLength: 3, default: 'USD' })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, default: 'USD' })
	defaultCurrency: CurrencyCode;

	/**
	 * BCP-47 locale for translated content.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 10 })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	@MultiORMColumn({ type: 'varchar', length: 10, nullable: true })
	defaultLocale?: string;

	/**
	 * Prefix handed to the `sequence` row for this channel.
	 *
	 * Read when the numbering series for this channel is created, so that an order placed on this
	 * storefront is numbered the way the storefront numbers its documents.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	orderNumberPrefix?: string;

	/**
	 * Zero-padding width of the numeric part of an order number.
	 */
	@ApiProperty({ type: () => Number, default: 6 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 6 })
	orderNumberPadding: number;

	/**
	 * Channel-scoped overrides read by the checkout, tax and fulfilment strategies.
	 *
	 * A document rather than a column per override: the set of overrides a channel carries differs per
	 * domain, and a column per override would be a schema change per feature. It is read whole and
	 * merged over the organization-level defaults by the settings resolver, so a partial document means
	 * "everything not stated here is the organization's".
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	settings?: JsonData;

	/**
	 * Tenant extras. Read whole; nothing here is filtered on.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The region applied when the request does not resolve one.
	 *
	 * A reference to a configuration row, so it releases rather than cascades: deleting a region must
	 * not delete the storefront that named it as a fallback. When it is set the region is also a member
	 * of {@link regions} — the two cannot be allowed to disagree, and the service enforces it by
	 * requiring the membership row before it writes this column.
	 */
	@ApiPropertyOptional({ type: () => Region })
	@IsOptional()
	@MultiORMManyToOne(() => Region, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	defaultRegion?: IRegion;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Channel) => it.defaultRegion)
	@MultiORMColumn({ nullable: true, relationId: true })
	defaultRegionId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The hostnames that resolve to this channel.
	 *
	 * Owned by the channel: a hostname row has no meaning without it, which is why the reference
	 * cascades. The cascade is declared by the child's own relation, so this side is a plain read — a
	 * collection that cascaded saves would let a write to the channel invent hostname rows.
	 */
	@ApiPropertyOptional({ type: () => ChannelDomain, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => ChannelDomain, (it) => it.channel)
	domains?: IChannelDomain[];

	/**
	 * The regions published to this channel.
	 *
	 * The pivot rows themselves, not a resolved list of regions: the membership carries the fallback
	 * flag, and a consumer that needs the regions reads them through the pivot so that the flag and the
	 * region cannot be read from two different places.
	 */
	@ApiPropertyOptional({ type: () => ChannelRegion, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => ChannelRegion, (it) => it.channel)
	regions?: IChannelRegion[];
}

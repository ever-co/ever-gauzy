import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
	ChannelStatus,
	CurrencyCode,
	IRegion,
	IRegionCountry,
	IChannelRegion,
	JsonData
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { RegionCountry } from '../region-country/region-country.entity';
import { ChannelRegion } from '../channel-region/channel-region.entity';
import { MikroOrmRegionRepository } from './repository/mikro-orm-region.repository';

/**
 * The commercial geography — a currency, a tax-inclusivity default, a country set and the provider
 * keys enabled for it.
 *
 * **Why the row exists.** A cart has to be priced in one currency, taxed inclusively or exclusively,
 * and routed to the payment and shipping providers that are actually enabled where it is being bought.
 * Every one of those is a property of the *place*, not of the cart: two carts of the same basket in two
 * countries differ in all three. The region is that place, and it is a kernel table because pricing,
 * tax, inventory, fulfilment, purchasing and accounting all resolve it rather than only the commerce
 * plugins.
 *
 * **The country set is a relation and never a column.** `countries` is the union of the region's
 * `region_country` rows, and each of those carries two facts of its own — whether sales into the
 * country are tax exempt, and an optional province-level scope. A denormalised list of country
 * identifiers here would be a second answer to "is this address inside the region", and the two
 * answers would be read by different callers in the same checkout.
 *
 * **`currency` names a row of the currency master.** The check is made by the service on every write,
 * because the constraint is a rule about a value and not a relationship: a region whose currency has no
 * decimal places, no rounding mode and no tender flag cannot price a cart, and the failure would
 * otherwise appear at the first checkout rather than at the write that caused it.
 *
 * **The two `simple-array` provider columns are lists of registered strategy keys, not relations.**
 * A provider registry is owned by the capability that registers it, and a region is a kernel row that
 * must exist whether or not any provider package is installed; null means "every enabled provider", and
 * an explicit empty list means "none", which is why the columns are nullable and not defaulted.
 */
@ColumnIndex('UQ_region_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('UQ_region_default', ['organizationId'], {
	unique: true,
	where: '"isDefault" = true AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_region_org_status', ['organizationId', 'status'], {
	where: '"deletedAt" IS NULL'
})
// `UQ_region_default` is a uniqueness rule guarded by a **boolean**, so MySQL has no filtered index for
// it and no nullable key part expresses it either. The dialect expresses it the way the schema chapter
// prescribes for exactly this case: a stored generated `isDefaultKey` column that is `1` while the row
// is the live default and `NULL` otherwise, appended to the tuple. Live defaults then collide on the
// key, every non-default row is distinct because `NULL` values are distinct in a unique index, and a
// soft-deleted default releases the key. The generated column is declared by no entity and exists on
// MySQL only; the migration is where it is created.
@MultiORMEntity('region', { mikroOrmRepository: () => MikroOrmRegionRepository })
export class Region extends TenantOrganizationBaseEntity implements IRegion {
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
	 * Used by seeds, imports and the administration surface, which is why it is a code and not a name:
	 * a name is edited and a code is what a stored reference is written against.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * The region's currency, naming a row of the currency master.
	 *
	 * A cart created in the region defaults to it, and the tax and rounding strategies read it, so a
	 * code the currency master does not know is refused when the region is written rather than when the
	 * first cart is priced.
	 */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Whether this is the organization's default region.
	 *
	 * At most one live row per organization carries it, and the write that claims it releases the flag
	 * from the previous holder in the same transaction — a partial unique index cannot express
	 * "move the flag", only "there is at most one".
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * Whether displayed prices include tax in this region.
	 *
	 * A property of the place rather than of the price: the same catalogue price is quoted
	 * tax-inclusive in one region and exclusive in another, and the totals writer must know which
	 * before it adds a single line.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/**
	 * Registered tax-provider strategy key. Null means the built-in tax engine.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	taxProviderKey?: string;

	/**
	 * Allowed payment-provider codes in this region. Null means every enabled provider.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	paymentProviderKeys?: string[];

	/**
	 * Allowed shipping and carrier provider keys in this region. Null means every enabled provider.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	fulfillmentProviderKeys?: string[];

	/**
	 * Where the region stands in its life.
	 *
	 * The channel's vocabulary, shared deliberately: one filter and one navigation cover both, and a
	 * separate three-value type for the region would make a single filter over the two impossible
	 * without a mapping.
	 */
	@ApiProperty({ type: () => String, enum: ChannelStatus, default: ChannelStatus.ACTIVE })
	@IsEnum(ChannelStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: ChannelStatus, default: ChannelStatus.ACTIVE })
	status: ChannelStatus;

	/**
	 * Tenant extras. Read whole; nothing here is filtered on.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The countries the region serves, one row per country.
	 *
	 * Not an ORM cascade: a membership row is written and withdrawn by the operation that owns the
	 * region's country set, so a write that reached the region's aggregate by accident must not be able
	 * to invent or remove one. The database constraint is the other half of the same rule — the row
	 * cascades when the region itself is hard-deleted, which only a retention job does.
	 */
	@ApiPropertyOptional({ type: () => RegionCountry, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => RegionCountry, (it) => it.region)
	countries?: IRegionCountry[];

	/**
	 * The channels this region is published to.
	 *
	 * The mirror of {@link Channel.regions}, and declared here for the reads that start from the region:
	 * "which channels may sell into this geography" is asked by the tax and catalogue administration.
	 */
	@ApiPropertyOptional({ type: () => ChannelRegion, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => ChannelRegion, (it) => it.region)
	channels?: IChannelRegion[];
}

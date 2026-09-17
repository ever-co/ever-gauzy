import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { TaxCategory } from '../tax-category/tax-category.entity';
import { MikroOrmTaxRateRepository } from './repository/mikro-orm-tax-rate.repository';

/**
 * One rate of one category, scoped geographically and in time.
 *
 * A rate is what a document is actually taxed at, once the resolver has picked it: the zone columns
 * narrow it to a destination, the window narrows it to a moment, `priority` breaks a tie between two
 * equally specific rows, and `isCompound` / `isInclusive` say how the rate is applied. The conditional
 * rules a rate may carry are `rule` rows whose `ownerType` is `TAX_RATE` and whose `ownerId` is this
 * row's id; they narrow the candidate set further and never widen it, and they carry no foreign key
 * because the rule table is polymorphic by design.
 *
 * There is deliberately no `status` column. A rate is live when its window contains the moment and the
 * row is not soft-deleted; a second state machine beside the window would let the two disagree about
 * whether a rate applies.
 *
 * The zone tuple is read first and most often, so it leads with the region; the organization and the
 * priority are read together to break a tie inside one tenant; and the window is scanned by the
 * maintenance screens. The window in the migration also carries `CHK_tax_rate_nonneg`, which keeps a
 * rate from being written below zero on the dialects that can hold the check.
 */
@ColumnIndex('IDX_tax_rate_zone', ['regionId', 'countryCode', 'provinceCode', 'taxCategoryId'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_tax_rate_org_priority', ['organizationId', 'priority'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_tax_rate_window', ['startsAt', 'endsAt'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_tax_rate_category', ['taxCategoryId'])
@MultiORMEntity('tax_rate', { mikroOrmRepository: () => MikroOrmTaxRateRepository })
export class TaxRate extends TenantOrganizationBaseEntity {
	/**
	 * The category the rate belongs to. A rate never exists outside one, so the relation is mandatory.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMManyToOne(() => TaxCategory, (category) => category.rates, {
		/** The rate has no meaning without its category. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	taxCategory?: TaxCategory;

	/**
	 * The category's id, as the queryable column.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	taxCategoryId: ID;

	/**
	 * Region the rate applies in; null means any region.
	 *
	 * The column is a plain identifier: the region is a platform lookup owned by core, and a rate is
	 * resolved for a destination a caller has already resolved, so nothing here needs the row itself.
	 * The zone index starts with this column, so it serves the referential check as well.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	regionId?: ID;

	/**
	 * ISO 3166-1 alpha-2 country code the rate applies in; null means any country.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2)
	@MultiORMColumn({ type: 'varchar', length: 2, nullable: true })
	countryCode?: string;

	/**
	 * Province, state or subdivision code the rate applies in; null means the whole country.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	provinceCode?: string;

	/**
	 * A pattern matched against the destination's postal code; null means any postal code.
	 *
	 * A pattern and not a list: a list would need a second table to hold it, and the destination a
	 * document carries is one postal code.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	postalCodePattern?: string;

	/**
	 * The rate as a fraction of the base — `0.200000` is twenty percent, never `20`. A fraction rather
	 * than a percentage, so that a rate is applied by one multiplication and no caller has to remember
	 * to divide by a hundred.
	 */
	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	rate: number;

	/**
	 * Human readable name, for example `Ontario provincial sales tax`.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Jurisdiction code copied onto the tax line, for example `CA-ON-PST`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	code?: string;

	/**
	 * Whether the rate applies on the running total of the earlier rates of the same base rather than on
	 * the base alone. A compound rate is applied after the rates that are not.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isCompound: boolean;

	/**
	 * Whether prices at this rate already include the tax; null means the destination's region decides.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', nullable: true })
	isInclusive?: boolean;

	/**
	 * Whether this is the rate that applies when nothing more specific matches in the zone.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * Tie-break among equally specific rates: the higher priority wins, and a compound rate declares one
	 * so that its position in the chain is deterministic.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * External engine that owns the rate, when one does. Null for a rate the platform computes itself.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	providerKey?: string;

	/**
	 * Start of the window the rate is live in; null means it has always been live.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	startsAt?: Date;

	/**
	 * End of the window the rate is live in; null means it stays live until it is ended.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	endsAt?: Date;

	/**
	 * Tenant-defined, non-indexed extras (a filing reference, the authority that published the rate).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}

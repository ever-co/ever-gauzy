import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { TaxRegimeRate } from '../tax-regime-rate/tax-regime-rate.entity';
import { MikroOrmTaxRegimeRepository } from './repository/mikro-orm-tax-regime.repository';

/**
 * The named set of rates a party or a destination switches to.
 *
 * This is the one mechanism that lets a product priced once be sold legally in many jurisdictions: the
 * same catalogue line is taxed to a private domestic buyer, zero-rated plus reverse charge to a business
 * that states a registration number, split into state, county and city taxes to a buyer in a nexus
 * state, and zero on export. A category changes **which single rate wins**; it cannot add a tax, cannot
 * remove a domestic one, cannot be conditioned on the buyer's registration status and cannot be
 * triggered by the destination independently of the party. A rule only ever narrows a candidate set. A
 * regime swaps it.
 *
 * The rule the design turns on is one sentence: **a rate with no membership row is general and always a
 * candidate; a rate with at least one membership row is a candidate only when one of its regimes is the
 * selected one.** Membership is how a rate is made regime-specific and the absence of a row is how it
 * stays general, so every rate keeps its exact behaviour until it is deliberately attached to a regime.
 *
 * `priority` is mandatory in effect: a regime decides tax, and an ambiguous one must not be a coin toss.
 * The commercial geography is deliberately **not** repurposed as the switch — a region decides currency
 * and tax inclusivity and a rule narrows a candidate set, and folding the tax set into either would make
 * "the same region, two tax treatments" unsayable, which is exactly the case this table exists for.
 */
/** A code is unique inside an organization among the regimes that are not soft-deleted. */
@ColumnIndex('UQ_tax_regime_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
/** The destination match, which is what selecting a regime for a document reads. */
@ColumnIndex('IDX_tax_regime_match', ['organizationId', 'countryCode', 'provinceCode', 'priority'], {
	where: '"deletedAt" IS NULL'
})
/** The window scan, which is what makes a regime live or not. */
@ColumnIndex('IDX_tax_regime_window', ['startsAt', 'endsAt'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('tax_regime', { mikroOrmRepository: () => MikroOrmTaxRegimeRepository })
export class TaxRegime extends TenantOrganizationBaseEntity {
	/**
	 * Human readable name, for example `Domestic standard rate`.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Stable code the rest of the platform quotes: `DOMESTIC`, `B2B-REVERSE-CHARGE`, `OSS`, `NEXUS-CA`,
	 * `EXPORT`. Unique inside an organization.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Tie-break among equally specific regimes: the higher priority wins, then the later window, then the
	 * id, so two runs over the same data always select the same regime.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * Region the regime applies in; null means any region. A plain identifier: the region is a platform
	 * lookup owned by core, and a regime is selected for a destination a caller has already resolved.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	regionId?: ID;

	/**
	 * ISO 3166-1 alpha-2 country code the regime applies in; null means any country.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2)
	@MultiORMColumn({ type: 'varchar', length: 2, nullable: true })
	countryCode?: string;

	/**
	 * Province, state or subdivision code the regime applies in; null means the whole country.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	provinceCode?: string;

	/**
	 * A pattern matched against the destination's postal code; null means any postal code. A pattern and
	 * never a list, for the same reason a rate's zone states one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	postalCodePattern?: string;

	/**
	 * Whether the regime applies only when the party states a usable registration number. This is the
	 * buyer-registration condition that makes reverse charge and intra-community zero-rating defensible.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	requiresPartyTaxRegistration: boolean;

	/**
	 * Start of the window the regime is live in; null means it has always been live.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	/**
	 * End of the window the regime is live in; null means it stays live until it is ended.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Operator-facing note: why the regime exists and who it was agreed with.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	description?: string;

	/**
	 * Tenant-defined, non-indexed extras (a filing reference, the authority that legislated the set).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The membership rows that name the rates this regime selects. A regime with no row selects nothing,
	 * and a regime that selects nothing is refused at write time rather than silently untaxing a
	 * jurisdiction.
	 */
	@MultiORMOneToMany(() => TaxRegimeRate, (membership) => membership.taxRegime)
	rates?: TaxRegimeRate[];
}

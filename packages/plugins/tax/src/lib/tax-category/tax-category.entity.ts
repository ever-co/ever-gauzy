import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { TaxRate } from '../tax-rate/tax-rate.entity';
import { MikroOrmTaxCategoryRepository } from './repository/mikro-orm-tax-category.repository';

/**
 * The taxable class of the things an organization sells and of the parties it sells to.
 *
 * A category carries no rate of its own: the rates of a category are `tax_rate` rows scoped
 * geographically and in time, so one category expresses "standard rated" in every jurisdiction the
 * organization trades in. The variant points at a category (`product_variant.taxCategoryId`) and so does
 * the party (`organization_contact.taxCategoryId`); when neither does, the organization's single
 * `isDefault` category applies.
 *
 * A category is a classification, never a ledger. What a document was actually charged is a `tax_line`
 * row owned by the platform, which is why nothing here stores an amount.
 */
/** A code is unique inside an organization among the categories that are not soft-deleted. */
@ColumnIndex('UQ_tax_category_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
/** One default category per organization. */
@ColumnIndex('UQ_tax_category_default', ['organizationId'], {
	unique: true,
	where: '"isDefault" = true AND "deletedAt" IS NULL'
})
/** The organization's live categories, which is what every administrative listing reads. */
@ColumnIndex('IDX_tax_category_org', ['organizationId'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('tax_category', { mikroOrmRepository: () => MikroOrmTaxCategoryRepository })
export class TaxCategory extends TenantOrganizationBaseEntity {
	/**
	 * Human readable name of the class, for example `Standard rate`.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Stable code the rest of the platform quotes, for example `STANDARD`, `REDUCED`, `ZERO` or `DIGITAL`.
	 * Unique inside an organization, because a rate's meaning is decided by the code its category carries.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * What the class covers, shown wherever an operator picks a category for a variant.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Whether this is the category an organization applies to a variant or a party that names none.
	 * Exactly one category per organization may be the default.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * Tenant-defined, non-indexed extras (an external taxonomy id, a reporting grouping).
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
	 * The rates of the category. They are the rows the resolver reads; a category with no rate is a
	 * classification nothing is charged under yet.
	 */
	@MultiORMOneToMany(() => TaxRate, (rate) => rate.taxCategory)
	rates?: TaxRate[];
}

import { JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt, IsNumber, IsUUID, Length, MaxLength } from 'class-validator';
import { ID, IExpense, IOrganizationVendor, ITag } from '@gauzy/contracts';
import { Expense, Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmOrganizationVendorRepository } from './repository/mikro-orm-organization-vendor.repository';

/**
 * The supplier master, extended rather than replaced.
 *
 * A supplier is the same concept as a party, separated only by the direction of trade, so it gains the
 * commercial terms a purchase order needs — a code, a default purchase currency, the settlement terms,
 * a lead time, an advisory minimum and the link to the party row when the same counterparty is also a
 * customer or a seller contact. The references the purchasing and tax packages own (`paymentTermId`,
 * `taxRegimeId`) are carried without their foreign keys; those sets add the constraints.
 */
@ColumnIndex('UQ_organization_vendor_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"code" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_organization_vendor_contact', ['contactId'], {
	where: '"contactId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_organization_vendor_payment_term', ['paymentTermId'], { where: '"paymentTermId" IS NOT NULL' })
@ColumnIndex('IDX_organization_vendor_tax_regime', ['taxRegimeId'], { where: '"taxRegimeId" IS NOT NULL' })
@MultiORMEntity('organization_vendor', { mikroOrmRepository: () => MikroOrmOrganizationVendorRepository })
export class OrganizationVendor extends TenantOrganizationBaseEntity implements IOrganizationVendor {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	email?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	phone?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	website?: string;

	/**
	 * Operator-facing supplier code, unique per organization where it is set; the key a purchase order
	 * or an import quotes.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	code?: string;

	/**
	 * Vendor-level default purchase currency. It prefills the purchase order's currency and is
	 * overridden by the winning vendor product term: a vendor who quotes one product in one currency and
	 * another in a second is ordinary, so a per-product currency is what the term row adds.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: string;

	/**
	 * Legacy simple form of the settlement terms, in days. It is retained, not repurposed: a non-null
	 * `paymentTermId` wins, and when neither is set the channel default applies.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	paymentTermsDays?: number;

	/**
	 * The instalment schedule agreed with this supplier. A negotiated term is an object many vendors
	 * share and a header can point at by id; "30 % on order, 70 % in 60 days" is not expressible as one
	 * integer. The constraint is added by the kernel migration that creates the term tables.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentTermId?: ID;

	/**
	 * Vendor-level default lead time in days, used only when the winning vendor product term carries
	 * none. It is stated as a fallback because every line from one vendor would otherwise get the same
	 * expected date, which is wrong for the mixed basket that is normal procurement.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	leadTimeDays?: number;

	/**
	 * Advisory minimum order **value**, surfaced as a warning at order time and never enforced. The
	 * per-product minimum is a quantity and lives on the vendor product term — two "minimums" meaning
	 * different things are deliberately not merged.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	minimumOrderAmount?: number;

	/**
	 * The party record of the same counterparty, when this supplier also exists as a customer, a lead or
	 * a seller contact. **Not unique**: one legal entity may legitimately hold two vendor accounts, so
	 * the column records identity, not cardinality. The linked contact must belong to the same
	 * organization, which is a service check.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	contactId?: ID;

	/**
	 * The tax regime that applies to purchases from this supplier. Reverse charge originates on the
	 * purchase side, so the regime a supplier is taxed under has to be nameable on the supplier. The
	 * constraint is added by the tax package's set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	taxRegimeId?: ID;

	/**
	 * Tenant-defined, non-indexed extras.
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
	 * Expense
	 */
	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@MultiORMOneToMany(() => Expense, (it) => it.vendor)
	expenses?: IExpense[];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tag
	 */
	@ApiPropertyOptional({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationVendors, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_vendor',
		joinColumn: 'organizationVendorId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_organization_vendor'
	})
	tags?: ITag[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ContactGroupType, ID, IContactGroup, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmContactGroupRepository } from './repository/mikro-orm-contact-group.repository';

/**
 * A named set of parties that prices, promotions, shipping and payment eligibility can target.
 *
 * **Why the row is small.** The commercial terms a group grants are a reference to a price list and a
 * group-wide discount; its membership is the pivot beside it. Everything a tenant wants to hang off a
 * group that nothing filters on lives in `metadata`, because a value a resolution branches on cannot
 * live in a document nothing indexes.
 *
 * **Why one table carries two kinds of segmentation.** Static and rule-based groups answer the same
 * question — "is this party in this set?" — and both are consumed by the same readers. The kind decides
 * only who writes the membership: a `STATIC` group's membership is its `contact_group_member` rows, and
 * a `RULE_BASED` group's membership is computed by the segment strategy from the group's `rule` rows and
 * is **never materialised**, so it cannot go stale.
 *
 * **The price list is a plain identifier, and deliberately not a relation object.** The price list is a
 * table the pricing capability owns; a kernel entity that imported that class would make the kernel
 * unbuildable until the capability exists. The column is created by the kernel migration **without** its
 * foreign key — a kernel migration never waits for a package to be installed — and the constraint is
 * added by the companion migration that runs after the pricing set, which is this platform's rule that a
 * constraint is added where its target is created.
 *
 * **The membership collection is not declared here.** The pivot's entity imports this class for its
 * `group` relation, so a collection property on this side would close a mutual import between two entity
 * classes; the platform's convention is to type such a property by its contract interface, and the
 * membership is in any case read through its own service. There is no stale copy of it on this row.
 */
@ColumnIndex('UQ_contact_group_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_contact_group_type', ['organizationId', 'type'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_contact_group_price_list', ['priceListId'], { where: '"priceListId" IS NOT NULL' })
@MultiORMEntity('contact_group', { mikroOrmRepository: () => MikroOrmContactGroupRepository })
export class ContactGroup extends TenantOrganizationBaseEntity implements IContactGroup {
	/**
	 * The display name of the group, as an operator reads it.
	 *
	 * Not unique and not a key: a tenant renames a group whenever it likes, and the stable identity an
	 * integration addresses is the code.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * The stable key the group is addressed by, unique per organization among live rows.
	 *
	 * A code is what an integration maps its own segment vocabulary onto and what a rule names, so a
	 * second live row carrying it would make a price list resolve to whichever row was reached first.
	 * The uniqueness is a partial index over live rows, because a soft-deleted group must not keep its
	 * code occupied forever.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/** What the group is for, in the tenant's own words. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Whether membership is explicit or computed.
	 *
	 * The default is `STATIC` — the conservative one: a group whose membership nobody has written is
	 * empty, whereas defaulting to a computed segment would make a group with no rules silently match
	 * either everybody or nobody depending on the evaluator's reading of "no conditions".
	 */
	@ApiProperty({ type: () => String, enum: ContactGroupType, default: ContactGroupType.STATIC })
	@IsEnum(ContactGroupType)
	@MultiORMColumn({ type: 'simple-enum', enum: ContactGroupType, default: ContactGroupType.STATIC })
	type: ContactGroupType;

	/**
	 * The price list granted to every member of this group.
	 *
	 * A party's own price list wins over the group's, and the group's wins over the default list, so
	 * this column is the middle rung of the resolution order rather than an override of the party.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	priceListId?: ID;

	/**
	 * The group-wide discount, as a **fraction** and not as a percentage: `0.1` is ten per cent.
	 *
	 * `numeric(9,6)` with the platform's numeric transformer, because the driver hands a `numeric` back
	 * as a string and a discount compared as a string is a defect that only shows on some values.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 9,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	discountPercent?: number;

	/**
	 * A group the platform maintains, which an operator may neither delete nor re-code.
	 *
	 * Written by the platform's own seeding path and immutable afterwards: a caller that could promote
	 * its own group to undeletable would be deciding a platform matter, and one that could demote a
	 * system group would be deleting a group the platform's own logic names.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isSystem: boolean;

	/** Tenant-defined extras (a display colour, an external segment id) that nothing filters on. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}

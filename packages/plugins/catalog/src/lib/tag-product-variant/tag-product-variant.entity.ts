import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	Tag,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmTagProductVariantRepository } from './repository/mikro-orm-tag-product-variant.repository';

/**
 * A variant-level facet on the platform tag system.
 *
 * A facet is a tag: `tag_type` is the facet ("colour") and `tag` is its value ("red"). The product-level
 * pivot the platform already has cannot answer a variant question, and it must not: a filter for
 * "colour = red AND size = M" has to return the M/red variant, not every variant of a product that
 * happens to have a red one.
 *
 * This is the one table in the catalog set with **no soft-delete column of its own**. A soft-deleted
 * join row would keep a facet attached as far as every existing tag query on the platform is
 * concerned, because those queries do not know this table exists. Removal is therefore a hard delete of
 * the pair, matching the shape of the platform's other tag pivots.
 */
@MultiORMEntity('tag_product_variant', { mikroOrmRepository: () => MikroOrmTagProductVariantRepository })
export class TagProductVariant extends TenantOrganizationBaseEntity {
	/**
	 * The tagged variant.
	 */
	@ApiProperty({ type: () => ProductVariant })
	@IsNotEmpty()
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	productVariant: ProductVariant;

	/**
	 * Id of the tagged variant.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TagProductVariant) => it.productVariant)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	productVariantId: ID;

	/**
	 * The facet value.
	 */
	@ApiProperty({ type: () => Tag })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Tag, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	tag: Tag;

	/**
	 * Id of the facet value.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TagProductVariant) => it.tag)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	tagId: ID;
}

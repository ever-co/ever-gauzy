import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Collection } from '../collection/collection.entity';
import { MikroOrmCollectionVariantRepository } from './repository/mikro-orm-collection-variant.repository';

/**
 * Manual membership of a single variant in a collection.
 *
 * The variant-level counterpart of `collection_product` exists because some merchandising is
 * expressed per variant and not per product: a "last sizes" shelf is a list of variants, and
 * expressing it as a list of products would show every size of every product on it.
 */
@MultiORMEntity('collection_variant', { mikroOrmRepository: () => MikroOrmCollectionVariantRepository })
export class CollectionVariant extends TenantOrganizationBaseEntity {
	/**
	 * The collection the variant was curated into.
	 */
	@ApiProperty({ type: () => Collection })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Collection, (it) => it.variants, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	collection: Collection;

	/**
	 * Id of the owning collection.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CollectionVariant) => it.collection)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	collectionId: ID;

	/**
	 * The curated variant.
	 */
	@ApiProperty({ type: () => ProductVariant })
	@IsNotEmpty()
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant: ProductVariant;

	/**
	 * Id of the curated variant.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CollectionVariant) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	variantId: ID;

	/**
	 * Ordering inside the collection.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/**
	 * When the variant was curated in; the "new in" ordering.
	 */
	@ApiProperty({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
	addedAt: Date;
}

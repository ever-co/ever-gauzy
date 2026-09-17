import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, Product, TenantOrganizationBaseEntity } from '@gauzy/core';
import { Collection } from '../collection/collection.entity';
import { MikroOrmCollectionProductRepository } from './repository/mikro-orm-collection-product.repository';

/**
 * Manual membership of a product in a collection.
 *
 * The row carries a position because a merchandiser orders a shelf deliberately, and it carries the
 * instant it was added because "new in" is the one ordering nobody wants to type by hand. A rule-based
 * collection materialises nothing here: its membership is computed on read, and writing pivot rows for
 * it would create a second copy of the answer that could disagree with the rules.
 */
@MultiORMEntity('collection_product', { mikroOrmRepository: () => MikroOrmCollectionProductRepository })
export class CollectionProduct extends TenantOrganizationBaseEntity {
	/**
	 * The collection the product was curated into.
	 */
	@ApiProperty({ type: () => Collection })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Collection, (it) => it.products, {
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
	@RelationId((it: CollectionProduct) => it.collection)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	collectionId: ID;

	/**
	 * The curated product.
	 */
	@ApiProperty({ type: () => Product })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Product, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: Product;

	/**
	 * Id of the curated product.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CollectionProduct) => it.product)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	productId: ID;

	/**
	 * Ordering inside the collection. Ties are broken by `addedAt` and then by the surrogate id, so a
	 * reorder rewrites the whole range in one transaction rather than relying on unique positions.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/**
	 * When the product was curated in. Read by "new in" collections, which is why it is a column of its
	 * own rather than a reuse of the row's creation instant: re-adding a product to a shelf is a new
	 * curation even when the row already existed.
	 */
	@ApiProperty({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
	addedAt: Date;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, Product, TenantOrganizationBaseEntity } from '@gauzy/core';
import { ProductRelationType } from '../catalog.types';
import { MikroOrmProductRelationRepository } from './repository/mikro-orm-product-relation.repository';

/**
 * A directed, typed link from one product to another.
 *
 * The link is directed on purpose: an upsell from a cheap product to a better one does not imply the
 * reverse, and a "goes well with" pair is often authored in one direction only. A reader therefore
 * sees the direction it asks for and nothing else. A target that is not published on the requesting
 * channel is filtered out at read time rather than deleted, because the relation is a statement about
 * the catalogue, not about one channel.
 */
@MultiORMEntity('product_relation', { mikroOrmRepository: () => MikroOrmProductRelationRepository })
export class ProductRelation extends TenantOrganizationBaseEntity {
	/**
	 * Source of the relation.
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
	 * Id of the source product.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductRelation) => it.product)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	productId: ID;

	/**
	 * Target of the relation.
	 */
	@ApiProperty({ type: () => Product })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Product, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	relatedProduct: Product;

	/**
	 * Id of the target product.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductRelation) => it.relatedProduct)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	relatedProductId: ID;

	/**
	 * The commercial intent of the link.
	 */
	@ApiProperty({ type: () => String, enum: ProductRelationType, default: ProductRelationType.RELATED })
	@IsEnum(ProductRelationType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: ProductRelationType, default: ProductRelationType.RELATED })
	type: ProductRelationType;

	/**
	 * Display order inside the relation type.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/**
	 * @returns True when the link points a product at itself, which the service rejects.
	 */
	isSelfReferencing(): boolean {
		return this.productId === this.relatedProductId;
	}
}

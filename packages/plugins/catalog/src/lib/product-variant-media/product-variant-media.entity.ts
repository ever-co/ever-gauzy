import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ImageAsset,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmProductVariantMediaRepository } from './repository/mikro-orm-product-variant-media.repository';

/**
 * One image in one variant's gallery.
 *
 * The product-level gallery the platform already has cannot express a per-variant set: a shirt photographed
 * in three colours is three galleries, and hanging all of them off the product shows a buyer every colour
 * whichever one they selected. `product_variant.imageId` therefore stays as it is — the legacy single
 * image — and this table is the gallery beside it.
 */
@MultiORMEntity('product_variant_media', { mikroOrmRepository: () => MikroOrmProductVariantMediaRepository })
export class ProductVariantMedia extends TenantOrganizationBaseEntity {
	/**
	 * The variant the image belongs to.
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
	 * Id of the variant.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductVariantMedia) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	variantId: ID;

	/**
	 * The image asset.
	 */
	@ApiProperty({ type: () => ImageAsset })
	@IsNotEmpty()
	@MultiORMManyToOne(() => ImageAsset, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	imageAsset: ImageAsset;

	/**
	 * Id of the image asset.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductVariantMedia) => it.imageAsset)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	imageAssetId: ID;

	/**
	 * Position in the variant's gallery.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/**
	 * The variant's thumbnail. At most one row per variant carries it; the service clears the previous
	 * primary in the same transaction that sets a new one.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isPrimary: boolean;
}

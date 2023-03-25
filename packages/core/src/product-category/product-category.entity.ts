import { Entity, Column, OneToMany, ManyToOne, JoinColumn, RelationId, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IImageAsset, IProductCategoryTranslatable } from '@gauzy/contracts';
import {
	ImageAsset,
	Product,
	ProductCategoryTranslation,
	TranslatableBase
} from '../core/entities/internal';

@Entity('product_category')
export class ProductCategory extends TranslatableBase
	implements IProductCategoryTranslatable {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	imageUrl: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@ManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: ImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ProductCategory) => it.image)
	@Index()
	@Column({ nullable: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product, isArray: true })
	@OneToMany(() => Product, (product) => product.productCategory)
	products: Product[];

	/**
	 * ProductCategoryTranslation
	 */
	@ApiProperty({ type: () => ProductCategoryTranslation, isArray: true })
	@OneToMany(() => ProductCategoryTranslation, (instance) => instance.reference, {
		eager: true,
		cascade: true
	})
	translations: ProductCategoryTranslation[];
}

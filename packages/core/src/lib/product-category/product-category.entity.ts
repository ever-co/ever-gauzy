import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IImageAsset, IProductCategoryTranslatable } from '@gauzy/contracts';
import {
	ImageAsset,
	Product,
	ProductCategoryTranslation,
	TranslatableBase
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmProductCategoryRepository } from './repository/mikro-orm-product-category.repository';

@MultiORMEntity('product_category', { mikroOrmRepository: () => MikroOrmProductCategoryRepository })
export class ProductCategory extends TranslatableBase
	implements IProductCategoryTranslatable {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	imageUrl: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMOneToMany(() => Product, (product) => product.productCategory)
	products: Product[];

	/**
	 * ProductCategoryTranslation
	 */
	@ApiProperty({ type: () => ProductCategoryTranslation, isArray: true })
	@MultiORMOneToMany(() => ProductCategoryTranslation, (instance) => instance.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade action. */
		cascade: true
	})
	translations: ProductCategoryTranslation[];
}

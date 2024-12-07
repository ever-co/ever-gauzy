import { ProductTypesIconsEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	Product,
	ProductTypeTranslation,
	TranslatableBase
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmProductTypeRepository } from './repository/mikro-orm-product-type.repository';

@MultiORMEntity('product_type', { mikroOrmRepository: () => MikroOrmProductTypeRepository })
export class ProductType extends TranslatableBase {

	@ApiProperty({ type: () => String, enum: ProductTypesIconsEnum })
	@MultiORMColumn({ nullable: true })
	icon: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product, isArray: true })
	@MultiORMOneToMany(() => Product, (product) => product.productType)
	products: Product[];

	/**
	 * ProductTypeTranslation
	 */
	@ApiProperty({ type: () => ProductTypeTranslation, isArray: true })
	@MultiORMOneToMany(() => ProductTypeTranslation, (productTypeTranslation) => productTypeTranslation.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade actions. */
		cascade: true
	})
	translations: ProductTypeTranslation[];
}

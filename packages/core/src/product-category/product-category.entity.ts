import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IProductCategoryTranslatable } from '@gauzy/contracts';
import {
	Product,
	ProductCategoryTranslation,
	TranslatableBase
} from '../core/entities/internal';

@Entity('product_category')
export class ProductCategory
	extends TranslatableBase
	implements IProductCategoryTranslatable {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	imageUrl: string;

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

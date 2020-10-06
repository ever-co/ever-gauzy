import { Entity, Column, OneToMany } from 'typeorm';
import { TranslatableBase } from '../core/entities/translate-base';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Product } from '../product/product.entity';
import { IProductCategoryTranslatable } from '@gauzy/models';

@Entity('product_category')
export class ProductCategory extends TranslatableBase
	implements IProductCategoryTranslatable {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	imageUrl: string;

	@OneToMany((type) => Product, (product) => product.category)
	products: Product[];

	@ApiProperty({ type: ProductCategoryTranslation, isArray: true })
	@OneToMany(
		(type) => ProductCategoryTranslation,
		(productCategoryTranslation) => productCategoryTranslation.reference,
		{
			eager: true,
			cascade: true
		}
	)
	translations: ProductCategoryTranslation[];
}

import { Entity, Column, OneToMany } from 'typeorm';
import { ProductTypesIconsEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import {
	Product,
	ProductTypeTranslation,
	TranslatableBase
} from '../core/entities/internal';

@Entity('product_type')
export class ProductType extends TranslatableBase {
	@ApiProperty({ type: () => String, enum: ProductTypesIconsEnum })
	@IsOptional()
	@IsEnum(ProductTypesIconsEnum)
	@Column({ nullable: true })
	icon: string;

	@OneToMany(() => Product, (product) => product.type)
	products: Product[];

	@ApiProperty({ type: () => ProductTypeTranslation, isArray: true })
	@OneToMany(
		() => ProductTypeTranslation,
		(productTypeTranslation) => productTypeTranslation.reference,
		{
			eager: true,
			cascade: true
		}
	)
	translations: ProductTypeTranslation[];
}

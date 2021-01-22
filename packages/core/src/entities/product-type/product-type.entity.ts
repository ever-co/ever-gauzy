import { Entity, Column, OneToMany } from 'typeorm';
import { DeepPartial, ProductTypesIconsEnum } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { Product, ProductTypeTranslation, TranslatableBase } from '../internal';

@Entity('product_type')
export class ProductType extends TranslatableBase {
	constructor(input?: DeepPartial<ProductType>) {
		super(input);
	}

	@ApiProperty({ type: String, enum: ProductTypesIconsEnum })
	@IsOptional()
	@IsEnum(ProductTypesIconsEnum)
	@Column({ nullable: true })
	icon: string;

	@OneToMany(() => Product, (product) => product.type)
	products: Product[];

	@ApiProperty({ type: ProductTypeTranslation, isArray: true })
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

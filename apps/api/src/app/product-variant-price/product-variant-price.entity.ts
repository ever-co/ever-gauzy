import { Entity, Column, OneToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import {
	ProductVariantPrice as IProductVariantPrice,
	CurrenciesEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum } from 'class-validator';
import { ProductVariant } from '../product-variant/product-variant.entity';

@Entity('product_variant_price')
export class ProductVariantPrice extends Base implements IProductVariantPrice {
	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	unitCost: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
	unitCostCurrency: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	retailPrice: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
	retailPriceCurrency: string;

	@OneToOne((type) => ProductVariant)
	productVariant: ProductVariant;
}

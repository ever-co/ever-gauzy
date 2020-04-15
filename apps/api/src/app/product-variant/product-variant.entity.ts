import { Base } from '../core/entities/base';
import {
	Entity,
	Column,
	OneToMany,
	ManyToOne,
	ManyToMany,
	JoinTable,
	OneToOne,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductVariant as IProductVariant } from '@gauzy/models';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { ProductOption } from '../product-option/product-option.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { Product } from '../product/product.entity';
import { IsNumber, IsString, IsOptional } from 'class-validator';

@Entity('product_variant')
export class ProductVariant extends Base implements IProductVariant {
	@ApiProperty({ type: Number })
	@IsNumber()
	@Column()
	taxes: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	notes: string;

	@ApiProperty({ type: String })
	@RelationId((productVariant: ProductVariant) => productVariant.product)
	@IsString()
	@Column()
	productId: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	quantity: number;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	billingInvoicingPolicy: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	internalReference: string;

	// @OneToMany(() => ProductOption, productOption => productOption.variant)
	options: ProductOption[];

	@OneToOne(() => ProductVariantSettings)
	settings: ProductVariantSettings;

	@OneToOne(() => ProductVariantPrice)
	price: ProductVariantPrice;

	@ManyToOne(() => Product)
	product?: Product;
}

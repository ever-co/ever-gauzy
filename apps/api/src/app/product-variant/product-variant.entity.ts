import { Base } from '../core/entities/base';
import {
	Entity,
	Column,
	ManyToOne,
	OneToOne,
	RelationId,
	JoinColumn,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ProductVariant as IProductVariant,
	BillingInvoicingPolicyEnum
} from '@gauzy/models';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { ProductOption } from '../product-option/product-option.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { Product } from '../product/product.entity';
import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';

@Entity('product_variant')
export class ProductVariant extends Base implements IProductVariant {
	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	taxes: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes: string;

	@ApiProperty({ type: String })
	@RelationId((productVariant: ProductVariant) => productVariant.product)
	@IsString()
	@Column({ nullable: true })
	productId: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	quantity: number;

	@ApiProperty({ type: String })
	@IsEnum(BillingInvoicingPolicyEnum)
	@Column({ default: BillingInvoicingPolicyEnum.QUANTITY_ORDERED })
	billingInvoicingPolicy: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	internalReference: string;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: true })
	enabled: boolean;

	@ManyToMany(() => ProductOption, { eager: true })
	@JoinTable()
	options: ProductOption[];

	@OneToOne(
		() => ProductVariantSettings,
		(settings) => settings.productVariant,
		{
			eager: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	settings: ProductVariantSettings;

	@OneToOne(
		() => ProductVariantPrice,
		(variantPrice) => variantPrice.productVariant,
		{
			eager: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	price: ProductVariantPrice;

	@ManyToOne(() => Product, (product) => product.variants, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: Product;
}

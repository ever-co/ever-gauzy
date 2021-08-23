import {
	Entity,
	Column,
	ManyToOne,
	OneToOne,
	RelationId,
	JoinColumn,
	ManyToMany,
	JoinTable,
	Index
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IProductVariant,
	BillingInvoicingPolicyEnum,
	IProductTranslatable,
	IProductVariantPrice,
	IProductVariantSetting,
	IProductOptionTranslatable
} from '@gauzy/contracts';
import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import {
	ImageAsset,
	Product,
	ProductOption,
	ProductVariantPrice,
	ProductVariantSetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('product_variant')
export class ProductVariant
	extends TenantOrganizationBaseEntity
	implements IProductVariant {
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	taxes: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	quantity: number;

	@ApiProperty({ type: () => String })
	@IsEnum(BillingInvoicingPolicyEnum)
	@Column({ default: BillingInvoicingPolicyEnum.QUANTITY_ORDERED })
	billingInvoicingPolicy: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	internalReference: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
	enabled: boolean;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * ProductVariantPrice
	 */
	@OneToOne(() => ProductVariantPrice, (variantPrice) => variantPrice.productVariant, { 
		eager: true,
		onDelete: 'CASCADE' 
	})
	@JoinColumn()
	price: IProductVariantPrice;

	/**
	 * ProductVariantSetting
	 */
	@OneToOne(() => ProductVariantSetting, (settings) => settings.productVariant, {
		eager: true,
		onDelete: 'CASCADE' 
	})
	@JoinColumn()
	setting: IProductVariantSetting;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product })
	@ManyToOne(() => Product, (product) => product.variants, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product?: IProductTranslatable;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductVariant) => it.product)
	@IsString()
	@Index()
	@Column({ nullable: true })
	productId?: string;

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset })
	@ManyToOne(() => ImageAsset, {
		eager: true
	})
	@JoinColumn()
	image?: ImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductVariant) => it.image)
	@IsString()
	@Index()
	@Column({ nullable: true })
	imageId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * ProductOption
	 */
	@ApiProperty({ type: () => ProductOption })
	@ManyToMany(() => ProductOption, { eager: true })
	@JoinTable()
	options: IProductOptionTranslatable[];
}

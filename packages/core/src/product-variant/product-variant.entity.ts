import {
	Column,
	ManyToOne,
	OneToOne,
	RelationId,
	JoinColumn,
	ManyToMany,
	JoinTable,
	Index,
	OneToMany
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IProductVariant,
	BillingInvoicingPolicyEnum,
	IProductTranslatable,
	IProductVariantPrice,
	IProductVariantSetting,
	IProductOptionTranslatable,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import {
	ImageAsset,
	Product,
	ProductOption,
	ProductVariantPrice,
	ProductVariantSetting,
	TenantOrganizationBaseEntity,
	WarehouseProductVariant
} from '../core/entities/internal';
import { Entity } from '@gauzy/common';

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
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	price: IProductVariantPrice;

	/**
	 * ProductVariantSetting
	 */
	@OneToOne(() => ProductVariantSetting, (settings) => settings.productVariant, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,

		/** Database cascade action on delete. */
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
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
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
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductOption
	 */
	@ApiProperty({ type: () => WarehouseProductVariant, isArray: true })
	@OneToMany(() => WarehouseProductVariant, (warehouseProductVariant) => warehouseProductVariant.variant, {
		cascade: true
	})
	warehouseProductVariants?: IWarehouseProductVariant[];

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

import { Entity, Column, OneToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductVariantSettings as IProductVariantSettings } from '@gauzy/models';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductVariant } from '../product-variant/product-variant.entity';

@Entity('product_variant_settings')
export class ProductVariantSettings extends Base
	implements IProductVariantSettings {
	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: false })
	isSubscription: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: false })
	isPurchaseAutomatically: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: true })
	canBeSold: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: true })
	canBePurchased: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: false })
	canBeCharged: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: false })
	canBeRented: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: false })
	isEquipment: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ default: false })
	trackInventory: boolean;

	@OneToOne(() => ProductVariant)
	productVariant: ProductVariant;
}

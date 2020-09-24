import { Entity, Column, OneToOne } from 'typeorm';
import { IProductVariantSetting } from '@gauzy/models';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('product_variant_setting')
export class ProductVariantSettings extends TenantOrganizationBase
	implements IProductVariantSetting {
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

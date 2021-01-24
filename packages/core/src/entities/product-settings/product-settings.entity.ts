import { Entity, Column, OneToOne } from 'typeorm';
import { IProductVariantSetting } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductVariant, TenantOrganizationBaseEntity } from '../internal';

@Entity('product_variant_setting')
export class ProductVariantSettings
	extends TenantOrganizationBaseEntity
	implements IProductVariantSetting {
	constructor(input?: DeepPartial<ProductVariantSettings>) {
		super(input);
	}

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

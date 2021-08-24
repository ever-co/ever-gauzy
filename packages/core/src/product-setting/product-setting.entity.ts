import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { IProductVariantSetting } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	ProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('product_variant_setting')
export class ProductVariantSetting
	extends TenantOrganizationBaseEntity
	implements IProductVariantSetting {
	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: false })
	isSubscription: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: false })
	isPurchaseAutomatically: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
	canBeSold: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
	canBePurchased: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: false })
	canBeCharged: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: false })
	canBeRented: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: false })
	isEquipment: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: false })
	trackInventory: boolean;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * ProductVariant
	 */
	@OneToOne(() => ProductVariant, (productVariant) => productVariant.setting, {
		onDelete: 'CASCADE' 
	})
	@JoinColumn()
	productVariant: ProductVariant;
}

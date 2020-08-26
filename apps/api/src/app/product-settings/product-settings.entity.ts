import { Entity, Column, OneToOne, RelationId } from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductVariantSettings as IProductVariantSettings } from '@gauzy/models';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { IsString } from 'class-validator';

@Entity('product_variant_settings')
export class ProductVariantSettings extends TenantBase
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(productVariantSettings: ProductVariantSettings) =>
			productVariantSettings.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}

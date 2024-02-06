import { ApiPropertyOptional } from '@nestjs/swagger';
import { Column, JoinColumn } from 'typeorm';
import { IProductVariantSetting } from '@gauzy/contracts';
import {
	ProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductVariantSettingRepository } from './repository/mikro-orm-product-setting.repository';
import { MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('product_variant_setting', { mikroOrmRepository: () => MikroOrmProductVariantSettingRepository })
export class ProductVariantSetting extends TenantOrganizationBaseEntity implements IProductVariantSetting {

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
	@MultiORMOneToOne(() => ProductVariant, (productVariant) => productVariant.setting, {
		onDelete: 'CASCADE',
		owner: true,
	})
	@JoinColumn()
	productVariant: ProductVariant;
}

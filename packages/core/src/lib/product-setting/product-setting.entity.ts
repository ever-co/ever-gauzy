import { ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn } from 'typeorm';
import { IProductVariantSetting } from '@gauzy/contracts';
import {
	ProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from './../core/decorators/entity';
import { MikroOrmProductVariantSettingRepository } from './repository/mikro-orm-product-setting.repository';

@MultiORMEntity('product_variant_setting', { mikroOrmRepository: () => MikroOrmProductVariantSettingRepository })
export class ProductVariantSetting extends TenantOrganizationBaseEntity implements IProductVariantSetting {

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: false })
	isSubscription: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: false })
	isPurchaseAutomatically: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: true })
	canBeSold: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: true })
	canBePurchased: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: false })
	canBeCharged: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: false })
	canBeRented: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: false })
	isEquipment: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: false })
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
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	productVariant: ProductVariant;
}

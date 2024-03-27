import { JoinColumn } from 'typeorm';
import { IProductVariantPrice, CurrenciesEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum } from 'class-validator';
import {
	ProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from './../core/decorators/entity';
import { MikroOrmProductVariantPriceRepository } from './repository/mikro-orm-product-variant-price.repository';

@MultiORMEntity('product_variant_price', { mikroOrmRepository: () => MikroOrmProductVariantPriceRepository })
export class ProductVariantPrice extends TenantOrganizationBaseEntity implements IProductVariantPrice {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	unitCost: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@MultiORMColumn({ default: CurrenciesEnum.USD })
	unitCostCurrency: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	retailPrice: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@MultiORMColumn({ default: CurrenciesEnum.USD })
	retailPriceCurrency: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductVariant
	 */
	@MultiORMOneToOne(() => ProductVariant, (productVariant) => productVariant.price, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	productVariant: ProductVariant;
}

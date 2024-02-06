import { Column, JoinColumn } from 'typeorm';
import { IProductVariantPrice, CurrenciesEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum } from 'class-validator';
import {
	ProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductVariantPriceRepository } from './repository/mikro-orm-product-variant-price.repository';
import { MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('product_variant_price', { mikroOrmRepository: () => MikroOrmProductVariantPriceRepository })
export class ProductVariantPrice extends TenantOrganizationBaseEntity implements IProductVariantPrice {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	unitCost: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
	unitCostCurrency: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	retailPrice: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
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
		onDelete: 'CASCADE',
		owner: true
	})
	@JoinColumn()
	productVariant: ProductVariant;
}

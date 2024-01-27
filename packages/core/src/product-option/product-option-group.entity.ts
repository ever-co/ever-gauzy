import { Column, ManyToOne, JoinColumn, OneToMany, RelationId, Index } from 'typeorm';
import {
	Product,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IProductOptionGroupTranslatable } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
	ProductOption,
	ProductOptionGroupTranslation
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';

@MultiORMEntity('product_option_group')
export class ProductOptionGroup
	extends TenantOrganizationBaseEntity
	implements IProductOptionGroupTranslatable {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product })
	@ManyToOne(() => Product, (product) => product.optionGroups)
	@JoinColumn()
	product: Product;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductOptionGroup) => it.product)
	@IsString()
	@IsOptional()
	@Index()
	@Column()
	productId: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductOption
	 */
	@ApiProperty({ type: () => ProductOption, isArray: true })
	@OneToMany(() => ProductOption, (productOption) => productOption.group, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	options: ProductOption[];

	/**
	 * ProductOptionGroupTranslation
	 */
	@ApiProperty({ type: () => ProductOptionGroupTranslation, isArray: true })
	@OneToMany(() => ProductOptionGroupTranslation, (translation) => translation.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	translations: ProductOptionGroupTranslation[];
}

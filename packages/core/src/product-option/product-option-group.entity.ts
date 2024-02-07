import { JoinColumn, RelationId, Index } from 'typeorm';
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
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProductOptionGroupRepository } from './repository/mikro-orm-product-option-group.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('product_option_group', { mikroOrmRepository: () => MikroOrmProductOptionGroupRepository })
export class ProductOptionGroup extends TenantOrganizationBaseEntity implements IProductOptionGroupTranslatable {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
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
	@MultiORMManyToOne(() => Product, (product) => product.optionGroups)
	@JoinColumn()
	product: Product;

	@ApiProperty({ type: () => String })
	@RelationId((it: ProductOptionGroup) => it.product)
	@IsString()
	@IsOptional()
	@Index()
	@MultiORMColumn()
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
	@MultiORMOneToMany(() => ProductOption, (productOption) => productOption.group, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	options: ProductOption[];

	/**
	 * ProductOptionGroupTranslation
	 */
	@ApiProperty({ type: () => ProductOptionGroupTranslation, isArray: true })
	@MultiORMOneToMany(() => ProductOptionGroupTranslation, (translation) => translation.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	translations: ProductOptionGroupTranslation[];
}

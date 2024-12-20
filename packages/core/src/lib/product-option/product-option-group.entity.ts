import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IProductOptionGroupTranslatable } from '@gauzy/contracts';
import {
	Product,
	ProductOption,
	ProductOptionGroupTranslation,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmProductOptionGroupRepository } from './repository/mikro-orm-product-option-group.repository';

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
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
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

import { Column, ManyToOne, JoinColumn, OneToMany, RelationId, Index } from 'typeorm';
import { IProductOptionTranslatable, IProductOptionTranslation } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
	TenantOrganizationBaseEntity,
	ProductOptionTranslation
} from '../core/entities/internal';
import { ProductOptionGroup } from './product-option-group.entity';
import { Entity } from '@gauzy/common';

@Entity('product_option')
export class ProductOption
	extends TenantOrganizationBaseEntity
	implements IProductOptionTranslatable {

	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	code: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ProductOptionGroup
	 */
	@ApiPropertyOptional({ type: () => ProductOptionGroup })
	@ManyToOne(() => ProductOptionGroup, (group) => group.options)
	@JoinColumn()
	group?: ProductOptionGroup;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: ProductOption) => it.group)
	@IsString()
	@Index()
	@Column()
	groupId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => ProductOptionTranslation, isArray: true })
	@OneToMany(() => ProductOptionTranslation, (translation) => translation.reference, {
		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	translations: IProductOptionTranslation[];
}

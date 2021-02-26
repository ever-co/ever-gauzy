import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IProductOptionTranslatable } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
	Product,
	TenantOrganizationBaseEntity,
	ProductOptionTranslation
} from '../core/entities/internal';
import { ProductOptionGroup } from './product-option-group.entity';

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

	@ManyToOne(() => Product, (product) => product.options, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: Product;

	@ManyToOne(() => ProductOptionGroup, (group) => group.options)
	@JoinColumn()
	group: ProductOptionGroup;

	@OneToMany(() => ProductOption, (productOption) => productOption.group, {
		cascade: true
	})
	translations: ProductOptionTranslation[];
}

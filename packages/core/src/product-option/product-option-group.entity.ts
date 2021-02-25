import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import {
	Product,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IProductOptionGroupTranslatable } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
	ProductOption,
	ProductOptionGroupTranslation
} from '../core/entities/internal';

@Entity('product_option_group')
export class ProductOptionGroup
	extends TenantOrganizationBaseEntity
	implements IProductOptionGroupTranslatable {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	@ManyToOne(() => Product)
	@JoinColumn()
	product: Product;

	@OneToMany(() => ProductOption, (productOption) => productOption.group)
	options: ProductOption[];

	@OneToMany(() => ProductOption, (productOption) => productOption.group)
	translations: ProductOptionGroupTranslation[];
}

import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IProductOption } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Product } from '../product/product.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('product_option')
export class ProductOption
	extends TenantOrganizationBase
	implements IProductOption {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	code: string;

	@ManyToOne(() => Product, (product) => product.options, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: Product;
}

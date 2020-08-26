import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductOption as IProductOption } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Product } from '../product/product.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('product_option')
export class ProductOption extends TenantBase implements IProductOption {
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((productOption: ProductOption) => productOption.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}

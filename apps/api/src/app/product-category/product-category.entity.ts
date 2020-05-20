import {
	Entity,
	Column,
	OneToMany,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductCategory as IProductCategory } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Product } from '../product/product.entity';
import { Organization } from '../organization/organization.entity';

@Entity('product_category')
export class ProductCategory extends Base implements IProductCategory {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	imageUrl: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(productCategory: ProductCategory) => productCategory.organization
	)
	readonly organizationId: string;

	@OneToMany(
		(type) => Product,
		(product) => product.category
	)
	products: Product[];

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;
}

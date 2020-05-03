import {
	Entity,
	Column,
	OneToMany,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ProductType as IProductType } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Product } from '../product/product.entity';
import { Organization } from '../organization/organization.entity';

@Entity('product_type')
export class ProductType extends Base implements IProductType {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((productType: ProductType) => productType.organization)
	organizationId: string;

	@OneToMany(
		(type) => Product,
		(product) => product.type
	)
	products: Product[];

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;
}

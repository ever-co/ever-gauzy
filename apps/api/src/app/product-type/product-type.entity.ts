import {
	Entity,
	Column,
	OneToMany,
	ManyToOne,
	JoinColumn,
	RelationId,
} from 'typeorm';
import { Base } from '../core/entities/base';
import {
	ProductType as IProductType,
	ProductTypesIconsEnum,
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Product } from '../product/product.entity';
import { Organization } from '../organization/organization.entity';

@Entity('product_type')
export class ProductType extends Base implements IProductType {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	name: string;

	@OneToMany((type) => Product, (product) => product.type)
	products: Product[];

	@ApiProperty({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: String, enum: ProductTypesIconsEnum })
	@IsOptional()
	@IsEnum(ProductTypesIconsEnum)
	@Column({ nullable: true })
	icon: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((productType: ProductType) => productType.organization)
	readonly organizationId: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;
}

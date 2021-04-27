import {
	Entity,
	ManyToOne,
	JoinColumn,
	Column,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { TenantBaseEntity, Product } from '../core/entities/internal';
import { IWarehouseProduct } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';

@Entity('warehouse_product')
export class WarehouseProduct
	extends TenantBaseEntity
	implements IWarehouseProduct {
	@ManyToOne(() => Product)
	@JoinColumn()
	product: Product;

	@ApiProperty({ name: 'quantity' })
	@Column({ nullable: true, type: 'numeric', default: 0 })
	quantity: number;

	@ManyToMany(
		() => WarehouseProductVariant,
		(warehouseProductVariant) => warehouseProductVariant.warehouseProducts
	)
	@JoinTable({ name: 'warehouse_product_warehouse_variant' })
	variants: WarehouseProductVariant[];
}

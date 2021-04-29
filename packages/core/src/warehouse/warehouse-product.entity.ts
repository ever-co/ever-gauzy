import {
	Entity,
	ManyToOne,
	JoinColumn,
	Column,
	JoinTable,
	OneToMany
} from 'typeorm';
import {
	TenantBaseEntity,
	Product,
	Warehouse
} from '../core/entities/internal';
import { IWarehouseProduct } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';

@Entity('warehouse_product')
export class WarehouseProduct
	extends TenantBaseEntity
	implements IWarehouseProduct {
	@ManyToOne(() => Warehouse, (warehouse) => warehouse.products)
	@JoinColumn()
	warehouse: Warehouse;

	@ManyToOne(() => Product)
	@JoinColumn()
	product: Product;

	@ApiProperty({ name: 'quantity' })
	@Column({ nullable: true, type: 'numeric', default: 0 })
	quantity: number;

	@OneToMany(
		() => WarehouseProductVariant,
		(warehouseProductVariant) => warehouseProductVariant.warehouseProduct
	)
	@JoinColumn()
	variants: WarehouseProductVariant[];
}

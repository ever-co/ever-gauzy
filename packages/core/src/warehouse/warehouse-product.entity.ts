import {
	Entity,
	ManyToOne,
	JoinColumn,
	Column,
	OneToMany
} from 'typeorm';
import { IWarehouseProduct } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	TenantBaseEntity,
	Product,
	Warehouse,
	WarehouseProductVariant
} from '../core/entities/internal';

@Entity('warehouse_product')
export class WarehouseProduct
	extends TenantBaseEntity
	implements IWarehouseProduct {

	@ManyToOne(() => Warehouse, (warehouse) => warehouse.products, {
		onDelete: 'CASCADE'
	})
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

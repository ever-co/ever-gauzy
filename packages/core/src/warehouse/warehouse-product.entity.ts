import {
	Entity,
	ManyToOne,
	JoinColumn,
	Column,
	OneToMany
} from 'typeorm';
import { IWarehouse, IWarehouseProduct, IWarehouseProductVariant } from '@gauzy/contracts';
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
	warehouse: IWarehouse;

	@ManyToOne(() => Product, (product) => product.warehouses, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: Product;

	@ApiProperty({ name: 'quantity' })
	@Column({ nullable: true, type: 'numeric', default: 0 })
	quantity: number;

	@OneToMany(() => WarehouseProductVariant, (warehouseProductVariant) => warehouseProductVariant.warehouseProduct, {
		cascade: true
	})
	@JoinColumn()
	variants: IWarehouseProductVariant[];
}

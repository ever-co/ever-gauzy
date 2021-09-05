import {
	Entity,
	ManyToOne,
	JoinColumn,
	Column,
	OneToMany,
	RelationId,
	Index
} from 'typeorm';
import {
	IProductTranslatable,
	IWarehouse,
	IWarehouseProduct,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
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

	@ApiProperty({ name: 'quantity' })
	@Column({ nullable: true, type: 'numeric', default: 0 })
	quantity: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Warehouse
	 */
	@ApiProperty({ type: () => Warehouse })
	@ManyToOne(() => Warehouse, (warehouse) => warehouse.products, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	warehouse: IWarehouse;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProduct) => it.warehouse)
	@IsString()
	@Index()
	@Column({ nullable: true })
	warehouseId?: string;

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product })
	@ManyToOne(() => Product, (product) => product.warehouses, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: IProductTranslatable;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProduct) => it.product)
	@IsString()
	@Index()
	@Column()
	productId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => WarehouseProductVariant, isArray: true })
	@OneToMany(() => WarehouseProductVariant, (warehouseProductVariant) => warehouseProductVariant.warehouseProduct, {
		cascade: true
	})
	@JoinColumn()
	variants: IWarehouseProductVariant[];
}

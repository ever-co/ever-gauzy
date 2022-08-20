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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Product,
	Warehouse,
	WarehouseProductVariant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';

@Entity('warehouse_product')
export class WarehouseProduct extends TenantOrganizationBaseEntity
	implements IWarehouseProduct {

	@ApiPropertyOptional({ type: Number })
	@Column({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
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
	@Index()
	@Column()
	warehouseId: string;

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
	@Index()
	@Column()
	productId: string;

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

import { Entity, ManyToOne, JoinColumn, Column, ManyToMany } from 'typeorm';
import { TenantBaseEntity, ProductVariant } from '../core/entities/internal';
import { IWarehouseProductVariant } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { WarehouseProduct } from './warehouse-product.entity';

@Entity('warehouse_product_variant')
export class WarehouseProductVariant
	extends TenantBaseEntity
	implements IWarehouseProductVariant {
	@ManyToOne(() => ProductVariant)
	@JoinColumn()
	variant: ProductVariant;

	@ApiProperty({ name: 'quantity' })
	@Column({ nullable: true, type: 'numeric', default: 0 })
	quantity: number;

	@ManyToMany(
		() => WarehouseProduct,
		(warehouseProduct) => warehouseProduct.variants
	)
	warehouseProducts: WarehouseProduct[];
}

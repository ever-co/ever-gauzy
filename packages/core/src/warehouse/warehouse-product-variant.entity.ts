import { Entity, ManyToOne, JoinColumn, Column, RelationId, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IProductVariant, IWarehouseProduct, IWarehouseProductVariant } from '@gauzy/contracts';
import { TenantBaseEntity, ProductVariant, WarehouseProduct } from '../core/entities/internal';

@Entity('warehouse_product_variant')
export class WarehouseProductVariant
	extends TenantBaseEntity
	implements IWarehouseProductVariant {

	@ApiProperty({ name: 'quantity' })
	@Column({ nullable: true, type: 'numeric', default: 0 })
	quantity: number;

	@ManyToOne(() => ProductVariant)
	@JoinColumn()
	variant: IProductVariant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: WarehouseProductVariant) => it.variant)
	@IsString()
	@Index()
	@Column()
	variantId: string;

	@ManyToOne(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.variants, {
		onDelete: 'CASCADE'
	})
	warehouseProduct: IWarehouseProduct;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: WarehouseProductVariant) => it.warehouseProduct)
	@IsString()
	@Index()
	@Column()
	warehouseProductId: string;
}

import { JoinColumn, RelationId, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IProductVariant, IWarehouseProduct, IWarehouseProductVariant } from '@gauzy/contracts';
import { ProductVariant, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { WarehouseProduct } from './warehouse-product.entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmWarehouseProductVariantRepository } from './repository/mikro-orm-warehouse-product-variant.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('warehouse_product_variant', { mikroOrmRepository: () => MikroOrmWarehouseProductVariantRepository })
export class WarehouseProductVariant extends TenantOrganizationBaseEntity
	implements IWarehouseProductVariant {

	@ApiPropertyOptional({ type: Number })
	@MultiORMColumn({
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
	 * ProductVariant
	 */
	@ApiProperty({ type: () => ProductVariant })
	@MultiORMManyToOne(() => ProductVariant, (productVariant) => productVariant.warehouseProductVariants, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant: IProductVariant;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProductVariant) => it.variant)
	@IsString()
	@Index()
	@MultiORMColumn({ relationId: true })
	variantId: string;

	/**
	 * WarehouseProduct
	 */
	@MultiORMManyToOne(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.variants, {
		onDelete: 'CASCADE'
	})
	warehouseProduct: IWarehouseProduct;

	@ApiProperty({ type: () => String })
	@RelationId((it: WarehouseProductVariant) => it.warehouseProduct)
	@IsString()
	@Index()
	@MultiORMColumn({ relationId: true })
	warehouseProductId: string;
}

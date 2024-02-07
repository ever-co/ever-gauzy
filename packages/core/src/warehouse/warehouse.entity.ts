import {
	JoinColumn,
	JoinTable,
	Index,
	RelationId
} from 'typeorm';
import {
	ApiProperty,
	ApiPropertyOptional
} from '@nestjs/swagger';
import {
	IContact,
	IImageAsset,
	IMerchant,
	ITag,
	IWarehouse,
	IWarehouseProduct
} from '@gauzy/contracts';
import {
	Contact,
	Tag,
	TenantOrganizationBaseEntity,
	ImageAsset,
	Merchant
} from '../core/entities/internal';
import { WarehouseProduct } from './warehouse-product.entity';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany, MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('warehouse', { mikroOrmRepository: () => MikroOrmWarehouseRepository })
export class Warehouse extends TenantOrganizationBaseEntity implements IWarehouse {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	code: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	email: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: true })
	active: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset })
	@MultiORMManyToOne(() => ImageAsset, (imageAsset) => imageAsset.warehouses, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	logo?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Warehouse) => it.logo)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	logoId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Contact
	 */
	@ApiProperty({ type: () => Contact })
	@MultiORMOneToOne(() => Contact, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Warehouse) => it.contact)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * WarehouseProduct
	 */
	@ApiProperty({ type: () => WarehouseProduct, isArray: true })
	@MultiORMOneToMany(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.warehouse, {
		cascade: true
	})
	@JoinColumn()
	products?: IWarehouseProduct[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tag
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.warehouses, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_warehouse'
	})
	@JoinTable({
		name: 'tag_warehouse'
	})
	tags?: ITag[];

	/**
	 * Merchants
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@MultiORMManyToMany(() => Merchant, (it) => it.warehouses, {
		onDelete: 'CASCADE'
	})
	merchants?: IMerchant[];
}

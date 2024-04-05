import {
	JoinColumn,
	JoinTable,
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany, MultiORMOneToOne } from './../core/decorators/entity';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';

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
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	logo?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Warehouse) => it.logo)
	@ColumnIndex()
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
	@MultiORMOneToOne(() => Contact, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Warehouse) => it.contact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: IContact['id'];

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
	 * Warehouse Tags
	 */
	@MultiORMManyToMany(() => Tag, (it) => it.warehouses, {
		/** Defines the database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		/** Indicates that this entity (Warehouse) is the owner side of the relationship. */
		owner: true,
		/** Specifies the name of the pivot table in the database. */
		pivotTable: 'tag_warehouse',
		joinColumn: 'warehouseId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		/** Specifies the name of the pivot table in the database. */
		name: 'tag_warehouse'
	})
	tags?: ITag[];

	/**
	 * Merchants
	 */
	@MultiORMManyToMany(() => Merchant, (it) => it.warehouses, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	merchants?: IMerchant[];
}

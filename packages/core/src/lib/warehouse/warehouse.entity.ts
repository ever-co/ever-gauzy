import {
	JoinColumn,
	JoinTable,
	RelationId
} from 'typeorm';
import {
	ApiProperty,
	ApiPropertyOptional
} from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	IContact,
	ID,
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
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	MultiORMOneToOne
} from './../core/decorators/entity';
import { WarehouseType } from '../core/enums/kernel-extension.enums';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';

/**
 * The stock location and its role in the network.
 *
 * A warehouse already modelled where stock sits; what the allocation strategy needs is *what kind* of
 * place it is, how it ranks against the other locations that could serve the same line, whether it
 * can be picked up from and whether it ships. `sellerId` is a seller's own location and is created
 * without its foreign key, because the seller table belongs to the marketplace package.
 */
@ColumnIndex('IDX_warehouse_org_type_priority', ['organizationId', 'type', 'priority'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_warehouse_org_fulfillment', ['organizationId', 'isFulfillmentLocation'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_warehouse_seller', ['sellerId', 'isFulfillmentLocation'], {
	where: '"sellerId" IS NOT NULL AND "deletedAt" IS NULL'
})
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

	/**
	 * The kind of location this is. It decides which locations the allocation strategy may pick and
	 * whether the stock held there is own stock or a supplier's.
	 */
	@ApiPropertyOptional({ type: () => String, enum: WarehouseType, default: WarehouseType.WAREHOUSE })
	@IsEnum(WarehouseType)
	@MultiORMColumn({ type: 'simple-enum', enum: WarehouseType, default: WarehouseType.WAREHOUSE })
	type?: WarehouseType;

	/**
	 * Allocation preference when several locations can serve a line; lower wins.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	priority?: number;

	/**
	 * The location can be selected as an in-store pickup point.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isPickupLocation?: boolean;

	/**
	 * The location may ship. False on a virtual or dropship placeholder that only aggregates.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isFulfillmentLocation?: boolean;

	/**
	 * Geocoding for pickup search and for distance-based allocation.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 10, scale: 6, nullable: true })
	latitude?: number;

	/**
	 * Longitude of the same point.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 10, scale: 6, nullable: true })
	longitude?: number;

	/**
	 * IANA zone used for the daily cutoff and for local reporting.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	timezone?: string;

	/**
	 * `HH:mm` local time after which an order ships the next working day.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 5 })
	@IsOptional()
	@IsString()
	@MaxLength(5)
	@MultiORMColumn({ type: 'varchar', length: 5, nullable: true })
	cutoffTime?: string;

	/**
	 * Set when the location is a seller's own; null for a platform location. It is what makes the
	 * seller-scoped allocation and fulfilment reads possible. The constraint is added by the
	 * marketplace package's set, which creates the seller table.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	sellerId?: ID;

	/**
	 * Tenant extras (dock count, carrier accounts).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

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

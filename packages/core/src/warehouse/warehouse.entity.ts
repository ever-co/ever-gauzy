import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	ManyToMany,
	JoinTable,
	OneToOne,
	Index,
	RelationId,
	OneToMany
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

@Entity('warehouse')
export class Warehouse extends TenantOrganizationBaseEntity implements IWarehouse {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column()
	code: string;

	@ApiProperty({ type: () => String })
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
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
	@ManyToOne(() => ImageAsset, (imageAsset) => imageAsset.warehouses, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	logo?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Warehouse) => it.logo)
	@Index()
	@Column({ nullable: true })
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
	@OneToOne(() => Contact, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Warehouse) => it.contact)
	@Index()
	@Column({ nullable: false })
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
	@OneToMany(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.warehouse, {
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
	@ManyToMany(() => Tag, (tag) => tag.warehouses, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
	@JoinTable({
		name: 'tag_warehouse'
	})
	tags?: ITag[];

	/**
	 * Merchants
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@ManyToMany(() => Merchant, (it) => it.warehouses, {
		onDelete: 'CASCADE'
	})
	merchants?: IMerchant[];
}

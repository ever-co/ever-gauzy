import {
	IMerchant,
	CurrenciesEnum,
	IImageAsset,
	ITag,
	IWarehouse,
	IContact
} from '@gauzy/contracts';
import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	JoinTable,
	ManyToMany,
	OneToOne,
	Index,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	TenantOrganizationBaseEntity,
	ImageAsset,
	Tag,
	Contact,
	Warehouse,
} from '../core/entities/internal';

@Entity('merchant')
export class Merchant extends TenantOrganizationBaseEntity implements IMerchant {

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
	phone: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
	active: boolean;

	@ApiProperty({ type: () => String })
	@Column({ default: CurrenciesEnum.USD })
	currency: CurrenciesEnum;

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
	@RelationId((it: Merchant) => it.contact)
	@Index()
	@Column({ nullable: true })
	contactId?: IContact['id'];

	/*
    |--------------------------------------------------------------------------
    | @OneToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset })
	@ManyToOne(() => ImageAsset, { cascade: true })
	@JoinColumn()
	logo?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Merchant) => it.logo)
	@Index()
	@Column({ nullable: true })
	logoId?: IImageAsset['id'];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */

	/**
	 * Tag
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.merchants, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
	@JoinTable({
		name: 'tag_merchant'
	})
	tags?: ITag[];

	/**
	 * Warehouses
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@ManyToMany(() => Warehouse, (it) => it.merchants, {
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'warehouse_merchant'
	})
	warehouses?: IWarehouse[];
}
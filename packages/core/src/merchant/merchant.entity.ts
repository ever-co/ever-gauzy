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
	IsBoolean,
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString
} from 'class-validator';
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
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	code: string;

	@ApiProperty({ type: () => String })
	@IsEmail()
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	phone: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	active: boolean;

	@ApiProperty({ type: () => String })
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
	currency: string;

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
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	contactId?: string;

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
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	logoId?: string;

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
	 * Warehouse
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@ManyToMany(() => Warehouse)
	@JoinTable({
		name: 'warehouse_merchant'
	})
	warehouses?: IWarehouse[];
}
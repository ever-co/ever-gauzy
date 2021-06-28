import { IMerchant, CurrenciesEnum, IImageAsset, ITag, IWarehouse, IContact } from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity, ImageAsset, Tag, Contact, Warehouse,
} from '../core/entities/internal';
import { Entity, Column, ManyToOne, JoinColumn, JoinTable, ManyToMany, OneToOne, Index, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

@Entity('merchant')
export class Merchant extends TenantOrganizationBaseEntity implements IMerchant {

	@ApiProperty()
	@IsString()
	@Column()
	name: string;

	@ApiProperty()
	@IsString()
	@Column()
	code: string;

	@ApiProperty()
	@IsString()
	@Column()
	email: string;

	@ApiProperty()
	@IsString()
	@Column({nullable: true})
	phone: string;

	@ApiProperty()
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty()
	@Column({ default: true })
	active: boolean;

	@ApiProperty()
	@ManyToOne(() => Contact, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Merchant) => it.contact)
	@IsString()
	@Index()
	@Column()
	contactId: string;

	@ApiProperty()
	@ManyToOne(
		() => ImageAsset,
		{ cascade: true }
	)
	@JoinColumn()
	logo: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Merchant) => it.logo)
	@IsString()
	@Index()
	@Column()
	logoId: string;

	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_merchant'
	})
	tags: ITag[];

	@ApiProperty()
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
	currency: string;

	@ManyToMany(() => Warehouse)
	@JoinTable({
		name: 'warehouse_merchant'
	})
	warehouses: IWarehouse[];
}
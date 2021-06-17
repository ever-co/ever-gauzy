import { IMerchant, CurrenciesEnum } from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity, ImageAsset, Tag, Contact, Warehouse,
} from '../core/entities/internal';
import { Entity, Column, ManyToOne, JoinColumn, JoinTable, ManyToMany, OneToOne } from 'typeorm';
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
	@OneToOne(() => Contact, {
		eager: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact: Contact;

	@ApiProperty()
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty()
	@ManyToOne(
		() => ImageAsset,
		{ cascade: true }
	)
	@JoinColumn()
	logo: ImageAsset;


	@ApiProperty()
	@Column({ default: true })
	active: boolean;

	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_merchant'
	})
	tags: Tag[];

	@ApiProperty()
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
	currency: string;


	@ManyToMany(() => Warehouse)
	@JoinTable({
		name: 'warehouse_merchant'
	})
	warehouses: Warehouse[];

}
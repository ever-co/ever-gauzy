import {
	IMerchant,
	CurrenciesEnum,
	IImageAsset,
	ITag,
	IWarehouse,
	IContact
} from '@gauzy/contracts';
import {
	JoinColumn,
	JoinTable,
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
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { ColumnIndex } from './../core/decorators/entity/index.decorator';
import { MikroOrmMerchantRepository } from './repository/mikro-orm-merchant.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('merchant', { mikroOrmRepository: () => MikroOrmMerchantRepository })
export class Merchant extends TenantOrganizationBaseEntity implements IMerchant {

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
	phone: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ default: true })
	active: boolean;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ default: CurrenciesEnum.USD })
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
	@MultiORMOneToOne(() => Contact, {
		cascade: true,
		onDelete: 'CASCADE',
		owner: true
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Merchant) => it.contact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMManyToOne(() => ImageAsset, { cascade: true })
	@JoinColumn()
	logo?: IImageAsset;

	@ApiProperty({ type: () => String })
	@RelationId((it: Merchant) => it.logo)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMManyToMany(() => Tag, (tag) => tag.merchants, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_merchant',
		joinColumn: 'merchantId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_merchant'
	})
	tags?: ITag[];

	/**
	 * Warehouses
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@MultiORMManyToMany(() => Warehouse, (it) => it.merchants, {
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'warehouse_merchant',
		joinColumn: 'merchantId',
		inverseJoinColumn: 'warehouseId',
	})
	@JoinTable({
		name: 'warehouse_merchant'
	})
	warehouses?: IWarehouse[];
}

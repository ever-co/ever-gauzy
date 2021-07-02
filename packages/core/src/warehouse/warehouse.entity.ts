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
import { IContact, ITag, IWarehouse } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
	Contact,
	Tag,
	WarehouseProduct,
	TenantOrganizationBaseEntity,
	ImageAsset
} from '../core/entities/internal';

@Entity('warehouse')
export class Warehouse extends TenantOrganizationBaseEntity implements IWarehouse {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ default: true })
	active: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	code: string;

	@ApiProperty()
	@ManyToOne(() => ImageAsset, { cascade: true })
	@JoinColumn()
	logo: ImageAsset;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Warehouse) => it.logo)
	@IsString()
	@Index()
	@Column({ nullable: false })
	logoId: string;

	@ApiProperty({ type: () => Contact })
	@OneToOne(() => Contact, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Warehouse) => it.contact)
	@IsString()
	@Index()
	@Column({ nullable: false })
	contactId: string;

	@OneToMany(() => WarehouseProduct, (warehouseProduct) => warehouseProduct.warehouse, {
		cascade: true 
	})
	@JoinColumn()
	products: WarehouseProduct[];

	@ManyToMany(() => Tag, (tag) => tag.merchants, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
	@JoinTable({
		name: 'tag_warehouse'
	})
	tags: ITag[];
}

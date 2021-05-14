import { IProductStore, CurrenciesEnum } from '@gauzy/contracts';
import {
	TenantOrganizationBaseEntity, ImageAsset, Tag, Contact, Warehouse,
} from '../core/entities/internal';
import { Entity, Column, ManyToOne, JoinColumn, JoinTable, ManyToMany, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';



@Entity('product_store')
export class ProductStore extends TenantOrganizationBaseEntity implements IProductStore {

    
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
	@OneToOne(() => Contact, {
		eager: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact: Contact;
    
    @ApiProperty()
    @IsString()
	@Column()
    description: string;
    
    @ApiProperty()
	@ManyToOne(
		() => ImageAsset
	)
	@JoinColumn()
	logo: ImageAsset;


	@ApiProperty()
	@Column({ default: true })
    active: boolean;
    
    @ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_product_store'
	})
    tags: Tag[];
    
    @ApiProperty()
	@IsEnum(CurrenciesEnum)
	@Column({ default: CurrenciesEnum.USD })
    currency: string;
    

    @ManyToMany(() => Warehouse)
	@JoinTable({
		name: 'warehouse_store'
	})
    warehouses: Warehouse[];

}
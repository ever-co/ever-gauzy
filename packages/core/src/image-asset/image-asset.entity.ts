import { IEquipment, IImageAsset, IWarehouse } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
import {
	Product,
	TenantOrganizationBaseEntity,
	Equipment,
	Warehouse
} from '../core/entities/internal';

@Entity('image_asset')
export class ImageAsset
	extends TenantOrganizationBaseEntity
	implements IImageAsset {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	url: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	width: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	height: number;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	isFeatured: boolean;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product, isArray: true })
	@OneToMany(() => Product, (product) => product.featuredImage, {
		onDelete: 'SET NULL'
	})
	productFeaturedImage?: Product[];

	/**
	 * Equipment
	 */
	@ApiProperty({ type: () => Equipment, isArray: true })
	@OneToMany(() => Equipment, (equipment) => equipment.image, {
		onDelete: 'SET NULL'
	})
	equipmentImage?: IEquipment[];

	/**
	 * Warehouse
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@OneToMany(() => Warehouse, (warehouse) => warehouse.logo, {
		onDelete: 'SET NULL'
	})
	warehouses?: IWarehouse[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product, isArray: true })
	@ManyToMany(() => Product, (product) => product.gallery)
	productGallery?: Product[];
}

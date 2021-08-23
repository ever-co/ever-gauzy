import { IEquipment, IImageAsset, IProduct } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
import {
	Product,
	TenantOrganizationBaseEntity,
	Equipment
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
	@OneToMany(() => Product, (product) => product.featuredImage)
	productFeaturedImage?: IProduct[];

	/**
	 * Equipment
	 */
	@ApiProperty({ type: () => Equipment, isArray: true })
	@OneToMany(() => Equipment, (equipment) => equipment.image)
	equipmentImage?: IEquipment[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Equipment, isArray: true })
	@ManyToMany(() => Product, (product) => product.gallery)
	productGallery?: IProduct[];
}

import { FileStorageProviderEnum, IEquipment, IImageAsset, IWarehouse } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	Product,
	TenantOrganizationBaseEntity,
	Equipment,
	Warehouse
} from './../core/entities/internal';

@Entity('image_asset')
export class ImageAsset extends TenantOrganizationBaseEntity
	implements IImageAsset {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	url: string

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	thumb?: string;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	width: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	height: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	size?: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: false })
	isFeatured: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	externalProviderId?: string;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@Exclude({ toPlainOnly: true })
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: FileStorageProviderEnum
	})
	storageProvider?: FileStorageProviderEnum;

	@ApiPropertyOptional({ type: () => 'timestamptz', required: false })
	@IsOptional()
	@IsDateString()
	@Column({ nullable: true })
	deletedAt?: Date;

	/** Additional fields */
	fullUrl?: string;
	thumbUrl?: string;

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

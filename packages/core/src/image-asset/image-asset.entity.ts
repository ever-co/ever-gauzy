import { FileStorageProviderEnum, IEquipment, IImageAsset, IWarehouse } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Column } from 'typeorm';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	Product,
	TenantOrganizationBaseEntity,
	Equipment,
	Warehouse
} from './../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmImageAssetRepository } from './repository/mikro-orm-image-asset.repository';
import { MultiORMManyToMany, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('image_asset', { mikroOrmRepository: () => MikroOrmImageAssetRepository })
export class ImageAsset extends TenantOrganizationBaseEntity implements IImageAsset {

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
	width?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	height?: number;

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
	isFeatured?: boolean;

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
	@MultiORMOneToMany(() => Product, (product) => product.featuredImage, {
		onDelete: 'SET NULL'
	})
	productFeaturedImage?: Product[];

	/**
	 * Equipment
	 */
	@ApiProperty({ type: () => Equipment, isArray: true })
	@MultiORMOneToMany(() => Equipment, (equipment) => equipment.image, {
		onDelete: 'SET NULL'
	})
	equipmentImage?: IEquipment[];

	/**
	 * Warehouse
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@MultiORMOneToMany(() => Warehouse, (warehouse) => warehouse.logo, {
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
	@MultiORMManyToMany(() => Product, (product) => product.gallery)
	productGallery?: Product[];
}

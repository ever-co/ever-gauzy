import { DeepPartial, IImageAsset } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { Column, Entity } from 'typeorm';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('image_asset')
export class ImageAsset
	extends TenantOrganizationBaseEntity
	implements IImageAsset {
	constructor(input?: DeepPartial<ImageAsset>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	url: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	width: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	height: number;

	@ApiProperty({ type: Boolean })
	@Column({ default: false })
	isFeatured: boolean;
}

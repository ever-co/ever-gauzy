import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Column } from 'typeorm';
import { TenantBase } from './tenant-base';

export abstract class TenantLocationBase extends TenantBase {
	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	city?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	address?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	address2?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	postcode?: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	regionCode?: string;
}

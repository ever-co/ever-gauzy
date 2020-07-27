import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { Entity, Column, Index } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';

@Entity('tenant')
export class Tenant extends Base {
	@ApiProperty({ type: String })
	@Index()
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	name?: string;

	// @ApiProperty({ type: Organization })
	// @OneToMany(
	// 	() => Organization,
	// 	(organization) => organization.tenant
	// )
	// @JoinColumn()
	// organizations?: Organization[];
}

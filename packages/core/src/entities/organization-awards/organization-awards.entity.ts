import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationAwards } from '@gauzy/common';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('organization_award')
export class OrganizationAwards
	extends TenantOrganizationBase
	implements IOrganizationAwards {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	year: string;
}

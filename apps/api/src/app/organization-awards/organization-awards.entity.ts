import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationAwards } from '@gauzy/models';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('organization_awards')
export class OrganizationAwards extends TenantOrganizationBase
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

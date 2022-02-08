import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { IOrganization, IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';
import { TenantBaseDTO } from './tenant-base.dto';

export abstract class TenantOrganizationBaseDTO extends TenantBaseDTO 
	implements IBasePerTenantAndOrganizationEntityModel {
	
	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly organization: IOrganization;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly organizationId: string;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';

export abstract class TenantBaseDTO 
	implements IBasePerTenantEntityModel {
	
	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly tenant: ITenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly tenantId: string;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';

export abstract class TenantBaseDTO 
	implements IBasePerTenantEntityModel {
	
	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly tenant: ITenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly tenantId: string;
}
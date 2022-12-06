import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';
import { IsTenantBelongsToUser } from './../../shared/validators';

export class TenantBaseDTO implements IBasePerTenantEntityModel {

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@IsTenantBelongsToUser()
	readonly tenant: ITenant;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsTenantBelongsToUser()
	readonly tenantId: ITenant['id'];
}
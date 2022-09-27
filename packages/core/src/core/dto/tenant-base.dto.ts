import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';
import { IsTenantBelongsToUser } from './../../shared/validators';

export abstract class TenantBaseDTO implements IBasePerTenantEntityModel {

	@ApiPropertyOptional({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	@IsTenantBelongsToUser()
	readonly tenant: ITenant;

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	@IsTenantBelongsToUser()
	readonly tenantId: ITenant['id'];
}
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject, ValidateIf, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';
import { IsTenantBelongsToUser } from './../../shared/validators';

export abstract class TenantBaseDTO implements IBasePerTenantEntityModel {

	@ApiPropertyOptional({ type: () => Object, readOnly: true })
	@IsOptional()
	@ValidateIf((it) => !it.tenantId)
	@IsObject()
	@IsTenantBelongsToUser()
	readonly tenant: ITenant;

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	@ValidateIf((it) => !it.tenant)
	@IsString()
	@IsTenantBelongsToUser()
	readonly tenantId: ITenant['id'];
}
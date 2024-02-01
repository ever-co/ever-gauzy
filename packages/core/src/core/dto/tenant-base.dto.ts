import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';
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
	@IsUUID()
	@IsTenantBelongsToUser()
	readonly tenantId: ITenant['id'];
}

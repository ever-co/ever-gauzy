import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import { TenantBaseDTO } from './../../core/dto';
import { IsOrganizationBelongsToUser } from './../../shared/validators';

/**
 * Entity Count DTO
 *
 */
export class CountQueryDTO<T>
	extends PickType(TenantBaseDTO, ['tenantId'])
	implements IBasePerTenantAndOrganizationEntityModel
{
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: ID;
}

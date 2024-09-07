import { PickType } from '@nestjs/swagger';
import { IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Delete query DTO
 *
 */
export class DeleteQueryDTO<T>
	extends PickType(TenantOrganizationBaseDTO, ['organizationId', 'tenantId'])
	implements IBasePerTenantAndOrganizationEntityModel {}

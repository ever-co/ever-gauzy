import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IBroadcastCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { Broadcast } from '../broadcast.entity';

/**
 * Create Broadcast data validation request DTO
 */
export class CreateBroadcastDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(Broadcast, ['employeeId', 'employee']))
	implements IBroadcastCreateInput {}

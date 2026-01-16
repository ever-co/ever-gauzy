import { OmitType, PartialType } from '@nestjs/swagger';
import { IBroadcastUpdateInput } from '@gauzy/contracts';
import { CreateBroadcastDTO } from './create-broadcast.dto';

/**
 * Update Broadcast data validation request DTO
 * Cannot update entity, entityId, employeeId after creation
 */
export class UpdateBroadcastDTO
	extends PartialType(OmitType(CreateBroadcastDTO, ['entity', 'entityId']))
	implements IBroadcastUpdateInput {}

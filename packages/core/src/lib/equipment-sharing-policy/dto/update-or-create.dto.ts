import { IEquipmentSharingPolicy } from '@gauzy/contracts';
import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy.entity';

/**
 * Update or Create Equipment Sharing Policy DTO
 */
export class UpdateOrCreateEquipmentSharingPolicyDTO
	extends IntersectionType(
		OmitType(EquipmentSharingPolicy, ['organizationId', 'organization', 'tenant', 'tenantId']),
		TenantOrganizationBaseDTO
	)
	implements IEquipmentSharingPolicy {}

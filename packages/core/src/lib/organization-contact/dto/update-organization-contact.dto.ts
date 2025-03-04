import { IOrganizationContactUpdateInput } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { RelationalTagDTO } from './../../tags/dto';
import { OrganizationContactDTO } from './organization-contact.dto';

/**
 * Update Organization Contact DTO request validation
 */
export class UpdateOrganizationContactDTO
	extends IntersectionType(OrganizationContactDTO, RelationalTagDTO)
	implements IOrganizationContactUpdateInput {}

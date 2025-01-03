import { IntersectionType } from '@nestjs/swagger';
import { IOrganizationUpdateInput } from '@gauzy/contracts';
import { CreateOrganizationDTO } from './create-organization.dto';
import { OrganizationPublicSettingDTO } from './organization-public-setting.dto';

/**
 * Organization Update DTO validation
 *
 */
export class UpdateOrganizationDTO
	extends IntersectionType(CreateOrganizationDTO, OrganizationPublicSettingDTO)
	implements IOrganizationUpdateInput {}

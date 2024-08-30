import { PartialType } from '@nestjs/swagger';
import { IOrganizationProjectModuleUpdateInput } from '@gauzy/contracts';
import { CreateOrganizationProjectModuleDTO } from './create-organization-project-module.dto';
export class UpdateOrganizationProjectModuleDTO
	extends PartialType(CreateOrganizationProjectModuleDTO)
	implements IOrganizationProjectModuleUpdateInput {}

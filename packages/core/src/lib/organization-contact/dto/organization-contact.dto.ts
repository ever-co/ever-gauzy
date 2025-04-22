import { IntersectionType, PickType } from '@nestjs/swagger';
import { OrganizationContact } from './../organization-contact.entity';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { RelationalTagDTO } from '../../tags/dto';

export class OrganizationContactDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	RelationalTagDTO,
	PickType(OrganizationContact, [
		'name',
		'primaryEmail',
		'primaryPhone',
		'inviteStatus',
		'contactType',
		'notes',
		'budget',
		'budgetType',
		'imageId'
	])
) {}

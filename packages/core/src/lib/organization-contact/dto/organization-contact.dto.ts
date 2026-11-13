import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
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
) {
	/** How many days after its issue an invoice to this contact falls due; zero is due on receipt. */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly paymentTermsDays?: number;
}

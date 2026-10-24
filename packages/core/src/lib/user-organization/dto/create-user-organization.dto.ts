import { ApiProperty, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantBaseDTO } from '../../core/dto';
import { IsOrganizationBelongsToUser } from '../../shared/validators';
import { UserOrganization } from '../user-organization.entity';

/**
 * The body of `POST /user-organization`: the members `CreateUserOrganizationInput` declares for the GraphQL twin, and
 * the tenant the Users page sends beside them.
 *
 * `organizationId` is the organization the membership grants, so it is checked as every organization a request names
 * is: a tenant admin may name any organization of the tenant, anyone else only the organization of their token (owner
 * decision 1). The route took the entity itself before, unvalidated, so a holder of `ORG_USERS_EDIT` added
 * themselves to any organization of the tenant and switched into it. Nothing else of the row (`id`, `deletedAt`,
 * `isArchived`, an `organization` or `user` object) is accepted.
 */
export class CreateUserOrganizationDTO extends IntersectionType(
	TenantBaseDTO,
	PartialType(PickType(UserOrganization, ['isDefault', 'isActive'] as const))
) {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly userId: ID;
}

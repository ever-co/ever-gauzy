import { PartialType, PickType } from '@nestjs/swagger';
import { UserOrganization } from '../user-organization.entity';

/**
 * The body of `PUT /user-organization/:id`: the members `UpdateUserOrganizationInput` declares for the GraphQL twin.
 *
 * A membership is never re-pointed at another person or another organization (that would move access without a
 * trace), so `userId`, `organizationId` and their relations are not accepted, nor any other column of the row. The
 * membership the path names is kept inside the caller's organization boundary by `UserOrganizationService.update`.
 */
export class UpdateUserOrganizationDTO extends PartialType(
	PickType(UserOrganization, ['isDefault', 'isActive'] as const)
) {}

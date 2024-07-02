import { IOrganizationGithubRepositoryUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../../core/dto';
import { OrganizationGithubRepository } from '../github-repository.entity';

/**
 * A Data Transfer Object (DTO) for updating an organization's GitHub repository.
 * This DTO is used to specify which properties of the repository should be updated.
 * It combines properties from different sources to define the structure for the update.
 */
export class UpdateGithubRepositoryDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(OrganizationGithubRepository, ['hasSyncEnabled']))
	implements IOrganizationGithubRepositoryUpdateInput {}

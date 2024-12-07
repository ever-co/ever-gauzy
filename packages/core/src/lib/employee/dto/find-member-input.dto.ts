import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IFindMembersInput, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Employee member query DTO
 */
export class FindMembersInputDTO extends TenantOrganizationBaseDTO implements IFindMembersInput {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	organizationTeamId: ID;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	organizationProjectId: ID;
}

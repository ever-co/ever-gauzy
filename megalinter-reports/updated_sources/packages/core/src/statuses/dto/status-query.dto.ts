import { IOrganizationProject, IStatusFindInput } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';

export class StatusQuerDTO
	extends TenantOrganizationBaseDTO
	implements IStatusFindInput
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	projectId?: IOrganizationProject['id'];
}

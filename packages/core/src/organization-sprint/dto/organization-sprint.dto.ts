import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { OrganizationSprint } from './../organization-sprint.entity';

export class OrganizationSprintDTO extends OrganizationSprint {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	memberIds?: ID[] = [];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	managerIds?: ID[] = [];
}

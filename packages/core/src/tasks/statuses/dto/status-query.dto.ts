import { IStatusFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { StatusDTO } from './status.dto';

export class StatusQuerDTO extends IntersectionType(
	PartialType(TenantOrganizationBaseDTO),
	PickType(StatusDTO, ['projectId'])
) implements IStatusFindInput {}

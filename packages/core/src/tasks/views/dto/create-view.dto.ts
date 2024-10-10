import { IntersectionType, PartialType } from '@nestjs/swagger';
import { ITaskViewCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskView } from '../view.entity';

export class CreateViewDTO
	extends IntersectionType(PartialType(TenantOrganizationBaseDTO), TaskView)
	implements ITaskViewCreateInput {}

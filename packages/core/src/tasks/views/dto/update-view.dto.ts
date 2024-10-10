import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskView } from '../view.entity';
import { ITaskViewUpdateInput } from '@gauzy/contracts';

export class UpdateViewDTO
	extends IntersectionType(PartialType(TenantOrganizationBaseDTO), PartialType(TaskView))
	implements ITaskViewUpdateInput {}

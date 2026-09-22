import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IDashboardUpdateInput } from '@gauzy/contracts';
import { Dashboard } from '../dashboard.entity';
import { CreateDashboardDTO } from './create-dashboard.dto';

/**
 * Update Dashboard validation request DTO
 *
 * Extends the create DTO (all fields optional) and re-allows `isDefault`,
 * which is excluded on creation but may be toggled on update
 * (e.g. "Set as Default" from the dashboard switcher).
 */
export class UpdateDashboardDTO
	extends IntersectionType(PartialType(CreateDashboardDTO), PickType(Dashboard, ['isDefault'] as const))
	implements IDashboardUpdateInput {}

import { IntersectionType } from '@nestjs/swagger';
import { IDashboardWidgetCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { DashboardWidget } from '../dashboard-widget.entity';

/**
 * Create Dashboard Widget validation request DTO
 */
export class CreateDashboardWidgetDTO
	extends IntersectionType(TenantOrganizationBaseDTO, DashboardWidget)
	implements IDashboardWidgetCreateInput {}

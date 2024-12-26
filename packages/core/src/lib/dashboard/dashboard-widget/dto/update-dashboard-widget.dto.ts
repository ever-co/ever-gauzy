import { PartialType } from '@nestjs/swagger';
import { IDashboardWidgetUpdateInput } from '@gauzy/contracts';
import { CreateDashboardWidgetDTO } from './create-dashboard-widget.dto';

export class UpdateDashboardWidgetDTO
	extends PartialType(CreateDashboardWidgetDTO)
	implements IDashboardWidgetUpdateInput {}

import { PartialType } from '@nestjs/swagger';
import { IDashboardUpdateInput } from '@gauzy/contracts';
import { CreateDashboardDTO } from './create-dashboard.dto';

/**
 * Update Dashboard validation request DTO
 */
export class UpdateDashboardDTO extends PartialType(CreateDashboardDTO) implements IDashboardUpdateInput {}

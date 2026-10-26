import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignBudgetUsageDTO } from './create-campaign-budget-usage.dto';

/**
 * Update CampaignBudgetUsage request: every field of the create shape, all of them optional.
 */
export class UpdateCampaignBudgetUsageDTO extends PartialType(CreateCampaignBudgetUsageDTO) {}

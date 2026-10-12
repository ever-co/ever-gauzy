import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignBudgetDTO } from './create-campaign-budget.dto';

/**
 * Update CampaignBudget request: every field of the create shape, all of them optional.
 */
export class UpdateCampaignBudgetDTO extends PartialType(CreateCampaignBudgetDTO) {}

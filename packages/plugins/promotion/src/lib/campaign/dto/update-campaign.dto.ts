import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignDTO } from './create-campaign.dto';

/**
 * Update Campaign request: every field of the create shape, all of them optional.
 */
export class UpdateCampaignDTO extends PartialType(CreateCampaignDTO) {}

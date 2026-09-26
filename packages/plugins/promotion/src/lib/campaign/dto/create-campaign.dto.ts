import { CampaignDTO } from './campaign.dto';

/**
 * Create Campaign request.
 *
 * The writable surface is the aggregate's own DTO; the tenant, the organization and the audit
 * columns come from the request context, never from the body.
 */
export class CreateCampaignDTO extends CampaignDTO {}

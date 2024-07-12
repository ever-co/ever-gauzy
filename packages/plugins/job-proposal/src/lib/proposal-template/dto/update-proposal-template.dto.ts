import { IEmployeeProposalTemplateUpdateInput } from '@gauzy/contracts';
import { ProposalTemplateDTO } from './proposal-template.dto';

/**
 * Update proposal template request DTO validation
 *
 */
export class UpdateProposalTemplateDTO extends ProposalTemplateDTO implements IEmployeeProposalTemplateUpdateInput {}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { IsOrganizationBelongsToUser } from './../../shared/validators';

/**
 * Create email template request DTO.
 *
 * Only the organization is validated here: the tenant is always the caller's own and is set by the
 * controller, never taken from the body (GHSA-44pv-34gx-q9p4). The remaining template fields are passed
 * through unchanged, as the inherited route did.
 */
export class CreateEmailTemplateDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId?: ID;
}

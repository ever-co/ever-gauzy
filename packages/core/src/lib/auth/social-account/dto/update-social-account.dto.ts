import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { ISocialAccountUpdateInput } from '@gauzy/contracts';
import { TenantBaseDTO } from '../../../core/dto';
import { CreateSocialAccountDTO } from './create-social-account.dto';

/**
 * Update Social Account DTO Validation
 */
export class UpdateSocialAccountDTO
	extends IntersectionType(TenantBaseDTO, PartialType(PickType(CreateSocialAccountDTO, ['providerAccountId'])))
	implements ISocialAccountUpdateInput {}

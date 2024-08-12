import { IUserUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { User } from '../user.entity';
import { CreateUserDTO } from './create-user.dto';

/**
 * Base class for updating user-related fields.
 */
class UpdateUserBaseDTO extends PickType(User, [
	'defaultOrganizationId',
	'defaultTeamId',
	'lastOrganizationId',
	'lastTeamId',
	'isActive'
] as const) {}

/**
 * Update User Data Transfer Object (DTO) validation.
 */
export class UpdateUserDTO
	extends IntersectionType(PartialType(CreateUserDTO), UpdateUserBaseDTO)
	implements IUserUpdateInput {}
